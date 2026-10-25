import {
  collection,
  getDocs,
  doc,
  writeBatch,
  addDoc,
  Firestore,
} from 'firebase/firestore';

export interface MigrationPlanItem {
  id: string;
  collectionName: 'shifts' | 'shiftTemplates' | 'settings';
  label: string;
  current: {
    type: string;
    startTime: string;
    endTime: string;
  };
  proposed: {
    type: string;
    startTime: string;
    endTime: string;
  };
  reason: string;
}

export interface MigrationSummary {
  totalScannedShifts: number;
  shiftsToUpdate: number;
  shiftsUnchanged: number;
  totalScannedTemplates: number;
  templatesToUpdate: number;
  templatesUnchanged: number;
  templatesCreated: number;
  items: MigrationPlanItem[];
  errors: string[];
}

export interface StandardShiftSpecification {
  type: string;
  startTime: string;
  endTime: string;
  canonicalName: string;
}

export const OFFICIAL_SHIFT_STANDARDS: Record<string, StandardShiftSpecification> = {
  '1st': {
    type: '1st Shift',
    startTime: '07:30',
    endTime: '16:30',
    canonicalName: '1st Shift · Day',
  },
  '2nd': {
    type: '2nd Shift',
    startTime: '12:30',
    endTime: '20:30',
    canonicalName: '2nd Shift · Swing',
  },
  '3rd': {
    type: '3rd Shift',
    startTime: '20:30',
    endTime: '07:30',
    canonicalName: '3rd Shift · Night',
  },
  general: {
    type: 'General',
    startTime: '09:00',
    endTime: '18:00',
    canonicalName: 'General · Day',
  },
  wo: {
    type: 'WO',
    startTime: '00:00',
    endTime: '00:00',
    canonicalName: 'WO · Week Off',
  },
  co: {
    type: 'CO',
    startTime: '09:00',
    endTime: '17:00',
    canonicalName: 'CO · Comp Off',
  },
};

/**
 * Maps any shift type or legacy timing to the official timing specification.
 */
export function resolveTargetShiftTiming(
  rawType: string,
  startTime: string,
  endTime: string
): StandardShiftSpecification | null {
  const typeLower = (rawType || '').toLowerCase().trim();
  const start = (startTime || '').trim();

  // 1st Shift / Morning / Alpha or starting at 06:00
  if (
    typeLower.includes('1st') ||
    typeLower.includes('morning') ||
    typeLower.includes('alpha') ||
    start === '06:00'
  ) {
    return OFFICIAL_SHIFT_STANDARDS['1st'];
  }

  // 2nd Shift / Afternoon / Swing / Bravo or starting at 14:00
  if (
    typeLower.includes('2nd') ||
    typeLower.includes('afternoon') ||
    typeLower.includes('swing') ||
    typeLower.includes('bravo') ||
    start === '14:00'
  ) {
    return OFFICIAL_SHIFT_STANDARDS['2nd'];
  }

  // 3rd Shift / Night / Nocturnal or starting at 22:00
  if (
    typeLower.includes('3rd') ||
    typeLower.includes('night') ||
    typeLower.includes('nocturnal') ||
    start === '22:00'
  ) {
    return OFFICIAL_SHIFT_STANDARDS['3rd'];
  }

  // General Shift
  if (typeLower.includes('general') || typeLower === 'gen') {
    return OFFICIAL_SHIFT_STANDARDS.general;
  }

  // Weekly Off
  if (
    typeLower === 'wo' ||
    typeLower.includes('week off') ||
    typeLower.includes('weekly off')
  ) {
    return OFFICIAL_SHIFT_STANDARDS.wo;
  }

  // Compensatory Off
  if (
    typeLower === 'co' ||
    typeLower.includes('comp off') ||
    typeLower.includes('compensatory')
  ) {
    return OFFICIAL_SHIFT_STANDARDS.co;
  }

  return null;
}

/**
 * Plans and calculates the required migration actions without modifying the database.
 */
export async function planShiftTimingsMigration(
  db: Firestore,
  options: { seedPresets?: boolean } = {}
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    totalScannedShifts: 0,
    shiftsToUpdate: 0,
    shiftsUnchanged: 0,
    totalScannedTemplates: 0,
    templatesToUpdate: 0,
    templatesUnchanged: 0,
    templatesCreated: 0,
    items: [],
    errors: [],
  };

  try {
    // 1. Scan Shifts collection
    const shiftsSnap = await getDocs(collection(db, 'shifts'));
    summary.totalScannedShifts = shiftsSnap.size;

    shiftsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const currentType = data.type || '';
      const currentStart = data.startTime || '';
      const currentEnd = data.endTime || '';

      const target = resolveTargetShiftTiming(currentType, currentStart, currentEnd);
      if (!target) {
        summary.shiftsUnchanged++;
        return;
      }

      const needsStartUpdate = currentStart !== target.startTime;
      const needsEndUpdate = currentEnd !== target.endTime;
      const isLegacyTypeName =
        currentType === 'Morning' ||
        currentType === 'Afternoon' ||
        currentType === 'Night';

      if (needsStartUpdate || needsEndUpdate || isLegacyTypeName) {
        summary.shiftsToUpdate++;
        summary.items.push({
          id: docSnap.id,
          collectionName: 'shifts',
          label: `${data.userName || data.userId || 'Shift'} · ${data.date || 'No Date'}`,
          current: {
            type: currentType,
            startTime: currentStart,
            endTime: currentEnd,
          },
          proposed: {
            type: isLegacyTypeName ? target.type : currentType,
            startTime: target.startTime,
            endTime: target.endTime,
          },
          reason: `Sync to official ${target.canonicalName} standards`,
        });
      } else {
        summary.shiftsUnchanged++;
      }
    });

    // 2. Scan shiftTemplates collection
    const templatesSnap = await getDocs(collection(db, 'shiftTemplates'));
    summary.totalScannedTemplates = templatesSnap.size;

    const existingPresetTypes = new Set<string>();

    templatesSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const currentType = data.type || '';
      const currentName = data.name || '';
      const currentStart = data.startTime || '';
      const currentEnd = data.endTime || '';

      const target = resolveTargetShiftTiming(
        `${currentType} ${currentName}`,
        currentStart,
        currentEnd
      );
      if (target) {
        existingPresetTypes.add(target.type);
        const needsUpdate =
          currentStart !== target.startTime || currentEnd !== target.endTime;
        if (needsUpdate) {
          summary.templatesToUpdate++;
          summary.items.push({
            id: docSnap.id,
            collectionName: 'shiftTemplates',
            label: `Template: ${currentName || currentType}`,
            current: {
              type: currentType,
              startTime: currentStart,
              endTime: currentEnd,
            },
            proposed: {
              type: target.type,
              startTime: target.startTime,
              endTime: target.endTime,
            },
            reason: `Align preset protocol with ${target.canonicalName} timing standard`,
          });
        } else {
          summary.templatesUnchanged++;
        }
      } else {
        summary.templatesUnchanged++;
      }
    });

    // 3. Check for missing preset templates to seed
    if (options.seedPresets) {
      Object.values(OFFICIAL_SHIFT_STANDARDS).forEach((spec) => {
        if (!existingPresetTypes.has(spec.type)) {
          summary.templatesCreated++;
          summary.items.push({
            id: `new-${spec.type.toLowerCase().replace(/\s+/g, '-')}`,
            collectionName: 'shiftTemplates',
            label: `Preset Protocol: ${spec.canonicalName}`,
            current: {
              type: '',
              startTime: '',
              endTime: '',
            },
            proposed: {
              type: spec.type,
              startTime: spec.startTime,
              endTime: spec.endTime,
            },
            reason: `Seed standard ${spec.canonicalName} preset template`,
          });
        }
      });
    }
  } catch (err) {
    summary.errors.push(err instanceof Error ? err.message : String(err));
  }

  return summary;
}

/**
 * Executes the planned migration, updating documents in safe Firestore batches.
 */
export async function executeShiftTimingsMigration(
  db: Firestore,
  summary: MigrationSummary,
  onProgress?: (progress: { completed: number; total: number; currentItem?: string }) => void
): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let updatedCount = 0;

  const validItems = summary.items.filter((item) => !item.id.startsWith('new-'));
  const newTemplateItems = summary.items.filter((item) => item.id.startsWith('new-'));
  const totalOperations = validItems.length + newTemplateItems.length;

  if (totalOperations === 0) {
    return { success: true, updatedCount: 0, errors: [] };
  }

  // 1. Process document updates in batches of 400 (safe limit under Firestore 500 ops)
  const BATCH_SIZE = 400;
  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    const chunk = validItems.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const docRef = doc(db, item.collectionName, item.id);
      batch.update(docRef, {
        startTime: item.proposed.startTime,
        endTime: item.proposed.endTime,
        type: item.proposed.type,
        updatedAt: Date.now(),
      });
    }

    try {
      await batch.commit();
      updatedCount += chunk.length;
      onProgress?.({
        completed: updatedCount,
        total: totalOperations,
        currentItem: chunk[chunk.length - 1]?.label,
      });
    } catch (batchErr) {
      const msg = `Batch commit failed at offset ${i}: ${batchErr instanceof Error ? batchErr.message : String(batchErr)}`;
      errors.push(msg);
      console.error(msg, batchErr);
    }
  }

  // 2. Insert any missing preset templates
  for (const item of newTemplateItems) {
    try {
      await addDoc(collection(db, 'shiftTemplates'), {
        name: item.label.replace('Preset Protocol: ', ''),
        startTime: item.proposed.startTime,
        endTime: item.proposed.endTime,
        type: item.proposed.type,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      updatedCount++;
      onProgress?.({
        completed: updatedCount,
        total: totalOperations,
        currentItem: item.label,
      });
    } catch (insertErr) {
      const msg = `Failed to insert template ${item.label}: ${insertErr instanceof Error ? insertErr.message : String(insertErr)}`;
      errors.push(msg);
      console.error(msg, insertErr);
    }
  }

  return {
    success: errors.length === 0,
    updatedCount,
    errors,
  };
}
