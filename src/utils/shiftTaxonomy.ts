import { Shift, UserProfile, IncidentTicket } from '../types';
import { format, addDays, parseISO, differenceInCalendarDays } from 'date-fns';

export type ShiftCategory =
  | 'first'
  | 'second'
  | 'third'
  | 'general'
  | 'off'
  | 'custom';

export interface ShiftPreset {
  id: string;
  label: string;
  shortCode: string;
  category: ShiftCategory;
  defaultStart: string;
  defaultEnd: string;
  hoursLabel: string;
  isRestDay: boolean;
}

export const SHIFT_PRESETS: ShiftPreset[] = [
  {
    id: '1st Shift',
    label: '1st Shift',
    shortCode: '1ST',
    category: 'first',
    defaultStart: '07:30',
    defaultEnd: '16:30',
    hoursLabel: '07:30 – 16:30',
    isRestDay: false,
  },
  {
    id: '2nd Shift',
    label: '2nd Shift',
    shortCode: '2ND',
    category: 'second',
    defaultStart: '12:30',
    defaultEnd: '20:30',
    hoursLabel: '12:30 – 20:30',
    isRestDay: false,
  },
  {
    id: '3rd Shift',
    label: '3rd Shift',
    shortCode: '3RD',
    category: 'third',
    defaultStart: '20:30',
    defaultEnd: '07:30',
    hoursLabel: '20:30 – 07:30',
    isRestDay: false,
  },
  {
    id: 'General',
    label: 'General',
    shortCode: 'GEN',
    category: 'general',
    defaultStart: '09:00',
    defaultEnd: '18:00',
    hoursLabel: '09:00 – 18:00',
    isRestDay: false,
  },
  {
    id: 'WO',
    label: 'WO (Week Off)',
    shortCode: 'WO',
    category: 'off',
    defaultStart: '00:00',
    defaultEnd: '00:00',
    hoursLabel: 'Week Off',
    isRestDay: true,
  },
  {
    id: 'CO',
    label: 'CO (Comp Off)',
    shortCode: 'CO',
    category: 'off',
    defaultStart: '09:00',
    defaultEnd: '17:00',
    hoursLabel: 'Comp Off',
    isRestDay: true,
  },
];

export function categorizeShiftType(rawType: string): ShiftCategory {
  const norm = (rawType || '').trim().toLowerCase();
  if (
    norm === '1st shift' ||
    norm === '1st' ||
    norm === 'first' ||
    norm === 'morning'
  ) {
    return 'first';
  }
  if (
    norm === '2nd shift' ||
    norm === '2nd' ||
    norm === 'second' ||
    norm === 'afternoon' ||
    norm === 'evening'
  ) {
    return 'second';
  }
  if (
    norm === '3rd shift' ||
    norm === '3rd' ||
    norm === 'third' ||
    norm === 'night'
  ) {
    return 'third';
  }
  if (norm === 'general' || norm === 'gen' || norm === 'day') {
    return 'general';
  }
  if (
    norm === 'wo' ||
    norm === 'co' ||
    norm === 'week off' ||
    norm === 'comp off' ||
    norm === 'off' ||
    norm === 'leave'
  ) {
    return 'off';
  }
  return 'custom';
}

export function isTimeOffShift(
  rawType: string,
  startTime?: string,
  endTime?: string
): boolean {
  const cat = categorizeShiftType(rawType);
  if (cat === 'off') return true;
  if (startTime === '00:00' && endTime === '00:00') return true;
  return false;
}

export function getPresetForShiftType(rawType: string): ShiftPreset {
  const norm = (rawType || '').trim().toLowerCase();
  if (norm === 'co' || norm === 'comp off') {
    return SHIFT_PRESETS.find((p) => p.id === 'CO')!;
  }
  if (norm === 'wo' || norm === 'week off') {
    return SHIFT_PRESETS.find((p) => p.id === 'WO')!;
  }
  const cat = categorizeShiftType(rawType);
  if (cat === 'first') return SHIFT_PRESETS[0];
  if (cat === 'second') return SHIFT_PRESETS[1];
  if (cat === 'third') return SHIFT_PRESETS[2];
  if (cat === 'general') return SHIFT_PRESETS[3];
  if (cat === 'off') return SHIFT_PRESETS[4];
  return {
    id: rawType || 'General',
    label: rawType || 'General',
    shortCode: (rawType || 'SHF').slice(0, 3).toUpperCase(),
    category: 'custom',
    defaultStart: '09:00',
    defaultEnd: '17:00',
    hoursLabel: '09:00 – 17:00',
    isRestDay: false,
  };
}

export function getNextCycledShiftPreset(currentType?: string): ShiftPreset {
  const order = ['1st Shift', '2nd Shift', '3rd Shift', 'General', 'WO', 'CO'];
  if (!currentType) return SHIFT_PRESETS[0];
  const preset = getPresetForShiftType(currentType);
  const idx = order.indexOf(preset.id);
  const nextId = order[(idx + 1) % order.length];
  return getPresetForShiftType(nextId);
}

export function getRotatedShiftType(rawType: string): {
  type: string;
  startTime: string;
  endTime: string;
} {
  const cat = categorizeShiftType(rawType);
  if (cat === 'first') {
    return { type: '2nd Shift', startTime: '12:30', endTime: '20:30' };
  }
  if (cat === 'second') {
    return { type: '3rd Shift', startTime: '20:30', endTime: '07:30' };
  }
  if (cat === 'third') {
    return { type: '1st Shift', startTime: '07:30', endTime: '16:30' };
  }
  const preset = getPresetForShiftType(rawType);
  return {
    type: rawType,
    startTime: preset.defaultStart,
    endTime: preset.defaultEnd,
  };
}

export function getShiftBadgeStyle(rawType: string): {
  badgeClass: string;
  barClass: string;
  dotClass: string;
  categoryLabel: string;
} {
  const norm = (rawType || '').trim().toLowerCase();
  const cat = categorizeShiftType(rawType);

  switch (cat) {
    case 'first':
      return {
        badgeClass:
          'bg-primary-subtle text-primary border-primary/35 hover:border-primary',
        barClass: 'bg-primary',
        dotClass: 'bg-primary',
        categoryLabel: '1st · 07:30–16:30',
      };
    case 'second':
      return {
        badgeClass:
          'bg-secondary-subtle text-secondary border-secondary/35 hover:border-secondary',
        barClass: 'bg-secondary',
        dotClass: 'bg-secondary',
        categoryLabel: '2nd · 12:30–20:30',
      };
    case 'third':
      return {
        badgeClass:
          'bg-info-subtle text-info border-info/35 hover:border-info',
        barClass: 'bg-info',
        dotClass: 'bg-info',
        categoryLabel: '3rd · 20:30–07:30',
      };
    case 'general':
      return {
        badgeClass:
          'bg-warning-subtle text-warning border-warning/35 hover:border-warning',
        barClass: 'bg-warning',
        dotClass: 'bg-warning',
        categoryLabel: 'General · 09:00–18:00',
      };
    case 'off':
      return {
        badgeClass:
          norm === 'co' || norm === 'comp off'
            ? 'bg-surface-3 text-main-text border border-primary/40 hover:border-primary'
            : 'bg-surface-3 text-main-text-muted border-main-border hover:border-main-text-muted',
        barClass:
          norm === 'co' || norm === 'comp off'
            ? 'bg-primary/50'
            : 'bg-main-text-disabled/40',
        dotClass:
          norm === 'co' || norm === 'comp off'
            ? 'bg-primary'
            : 'bg-main-text-disabled',
        categoryLabel: norm === 'co' || norm === 'comp off' ? 'Comp Off' : 'Week Off',
      };
    default:
      return {
        badgeClass:
          'bg-surface-3 text-main-text border-main-border hover:border-primary',
        barClass: 'bg-primary/80',
        dotClass: 'bg-primary',
        categoryLabel: rawType || 'Custom',
      };
  }
}

export function parseMinutes(timeStr: string): number {
  const [hStr, mStr] = (timeStr || '00:00').split(':');
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  return Math.min(1440, Math.max(0, h * 60 + m));
}

export function computeShiftDurationHours(
  startTime: string,
  endTime: string,
  rawType: string
): number {
  if (isTimeOffShift(rawType, startTime, endTime)) {
    return 0;
  }
  const startMin = parseMinutes(startTime);
  const endMin = parseMinutes(endTime);
  if (startMin === 0 && endMin === 0) return 0;
  let diffMin = endMin - startMin;
  if (diffMin <= 0) {
    diffMin += 1440;
  }
  return Math.round((diffMin / 60) * 10) / 10;
}

export function computeMiniBarSegments(
  startTime: string,
  endTime: string,
  rawType: string
): Array<{ leftPct: number; widthPct: number; isRest: boolean }> {
  if (isTimeOffShift(rawType, startTime, endTime)) {
    return [{ leftPct: 0, widthPct: 100, isRest: true }];
  }
  const startMin = parseMinutes(startTime);
  let endMin = parseMinutes(endTime);
  if (endMin === 0 && startMin > 0) {
    endMin = 1440;
  }

  if (endMin > startMin) {
    const duration = Math.max(60, endMin - startMin);
    const leftPct = (startMin / 1440) * 100;
    const widthPct = Math.min(100 - leftPct, (duration / 1440) * 100);
    return [{ leftPct, widthPct, isRest: false }];
  }

  // Overnight wrap (e.g. 22:00 -> 06:00)
  const segs: Array<{ leftPct: number; widthPct: number; isRest: boolean }> = [];
  const firstMin = 1440 - startMin;
  if (firstMin > 0) {
    segs.push({
      leftPct: (startMin / 1440) * 100,
      widthPct: (firstMin / 1440) * 100,
      isRest: false,
    });
  }
  if (endMin > 0) {
    segs.push({
      leftPct: 0,
      widthPct: (endMin / 1440) * 100,
      isRest: false,
    });
  }
  return segs.length > 0
    ? segs
    : [{ leftPct: 25, widthPct: 33.3, isRest: false }];
}

export interface ActiveShiftProgress {
  isLiveNow: boolean;
  elapsedPct: number;
  remainingLabel: string;
}

export function computeActiveShiftProgress(
  localDate: string,
  localStartTime: string,
  localEndTime: string,
  rawType: string,
  todayStr: string,
  nowMinutes: number
): ActiveShiftProgress {
  if (
    localDate !== todayStr ||
    isTimeOffShift(rawType, localStartTime, localEndTime)
  ) {
    return { isLiveNow: false, elapsedPct: 0, remainingLabel: '' };
  }

  const startMin = parseMinutes(localStartTime);
  const endMin = parseMinutes(localEndTime);

  if (endMin > startMin) {
    if (nowMinutes >= startMin && nowMinutes < endMin) {
      const total = Math.max(1, endMin - startMin);
      const elapsed = nowMinutes - startMin;
      const rem = endMin - nowMinutes;
      const hrs = Math.floor(rem / 60);
      const mins = rem % 60;
      return {
        isLiveNow: true,
        elapsedPct: Math.min(
          100,
          Math.max(4, Math.round((elapsed / total) * 100))
        ),
        remainingLabel: hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`,
      };
    }
    return { isLiveNow: false, elapsedPct: 0, remainingLabel: '' };
  }

  // Overnight shift (e.g. 22:00 - 06:00)
  const total = Math.max(1, 1440 - startMin + endMin);
  if (nowMinutes >= startMin) {
    const elapsed = nowMinutes - startMin;
    const rem = total - elapsed;
    const hrs = Math.floor(rem / 60);
    const mins = rem % 60;
    return {
      isLiveNow: true,
      elapsedPct: Math.min(
        100,
        Math.max(4, Math.round((elapsed / total) * 100))
      ),
      remainingLabel: hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`,
    };
  }
  if (nowMinutes < endMin) {
    const elapsed = 1440 - startMin + nowMinutes;
    const rem = endMin - nowMinutes;
    const hrs = Math.floor(rem / 60);
    const mins = rem % 60;
    return {
      isLiveNow: true,
      elapsedPct: Math.min(
        100,
        Math.max(4, Math.round((elapsed / total) * 100))
      ),
      remainingLabel: hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`,
    };
  }

  return { isLiveNow: false, elapsedPct: 0, remainingLabel: '' };
}

export interface OperatorWorkloadStats {
  userId: string;
  weeklyHours: number;
  consecutiveDays: number;
  hasClopenRisk: boolean;
  clopenDetail: string | null;
  nightShiftCount: number;
  restDayCount: number;
  equityScore: number;
  loadLevel: 'optimal' | 'elevated' | 'overloaded';
  dailySparkline: number[]; // 7 numbers for Mon..Sun hours
}

export interface LocalizedShiftRecord extends Shift {
  localDate: string;
  localStartTime: string;
  localEndTime: string;
}

export interface ShiftIndexMap {
  byDate: Map<string, LocalizedShiftRecord[]>;
  byUser: Map<string, LocalizedShiftRecord[]>;
  byUserDate: Map<string, LocalizedShiftRecord[]>;
}

/**
 * O(1) Pre-Computed Shift Index Map for 120fps rendering & zero O(N^2) scans
 */
export function buildShiftIndexMap(
  shifts: LocalizedShiftRecord[]
): ShiftIndexMap {
  const byDate = new Map<string, LocalizedShiftRecord[]>();
  const byUser = new Map<string, LocalizedShiftRecord[]>();
  const byUserDate = new Map<string, LocalizedShiftRecord[]>();

  for (const s of shifts) {
    const dateList = byDate.get(s.localDate);
    if (dateList) dateList.push(s);
    else byDate.set(s.localDate, [s]);

    const userList = byUser.get(s.userId);
    if (userList) userList.push(s);
    else byUser.set(s.userId, [s]);

    const key = `${s.userId}_${s.localDate}`;
    const udList = byUserDate.get(key);
    if (udList) udList.push(s);
    else byUserDate.set(key, [s]);
  }

  return { byDate, byUser, byUserDate };
}

export function computeOperatorWorkloadMap(
  shifts: LocalizedShiftRecord[],
  weekDays: Date[]
): Record<string, OperatorWorkloadStats> {
  const weekDateStrings = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
  const weekStartStr = weekDateStrings[0] || '0000-00-00';
  const weekEndStr =
    weekDateStrings[weekDateStrings.length - 1] || '9999-12-31';

  const byUser: Record<string, LocalizedShiftRecord[]> = {};
  for (const s of shifts) {
    if (!byUser[s.userId]) byUser[s.userId] = [];
    byUser[s.userId].push(s);
  }

  const result: Record<string, OperatorWorkloadStats> = {};

  for (const [userId, userShifts] of Object.entries(byUser)) {
    const sorted = [...userShifts].sort((a, b) =>
      `${a.localDate}T${a.localStartTime}`.localeCompare(
        `${b.localDate}T${b.localStartTime}`
      )
    );

    const weekScoped = sorted.filter(
      (s) => s.localDate >= weekStartStr && s.localDate <= weekEndStr
    );
    const targetList = weekScoped.length > 0 ? weekScoped : sorted.slice(0, 7);

    let weeklyHours = 0;
    let nightShiftCount = 0;
    let restDayCount = 0;

    // Compute 7-day daily sparkbar hours
    const dailySparkline = weekDateStrings.map((dStr) => {
      const dayMatches = weekScoped.filter((s) => s.localDate === dStr);
      let dayTotal = 0;
      for (const m of dayMatches) {
        dayTotal += computeShiftDurationHours(
          m.localStartTime,
          m.localEndTime,
          m.type
        );
      }
      return Math.round(dayTotal * 10) / 10;
    });

    for (const s of targetList) {
      const cat = categorizeShiftType(s.type);
      const isOff = isTimeOffShift(s.type, s.localStartTime, s.localEndTime);
      if (isOff) {
        restDayCount += 1;
      } else {
        const hrs = computeShiftDurationHours(
          s.localStartTime,
          s.localEndTime,
          s.type
        );
        weeklyHours += hrs;
        if (cat === 'third') {
          nightShiftCount += 1;
        }
      }
    }

    const workingShifts = sorted.filter(
      (s) => !isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
    );

    let maxStreak = workingShifts.length > 0 ? 1 : 0;
    let currentStreak = workingShifts.length > 0 ? 1 : 0;
    let hasClopenRisk = false;
    let clopenDetail: string | null = null;

    for (let i = 1; i < workingShifts.length; i++) {
      const prev = workingShifts[i - 1];
      const curr = workingShifts[i];

      try {
        const dayDiff = differenceInCalendarDays(
          parseISO(curr.localDate),
          parseISO(prev.localDate)
        );
        if (dayDiff === 1) {
          currentStreak += 1;
          if (currentStreak > maxStreak) maxStreak = currentStreak;

          const prevStartMin = parseMinutes(prev.localStartTime);
          const prevEndMin = parseMinutes(prev.localEndTime);
          const currStartMin = parseMinutes(curr.localStartTime);

          const restMinutes =
            prevEndMin > prevStartMin
              ? 1440 - prevEndMin + currStartMin
              : currStartMin - prevEndMin;

          if (restMinutes >= 0 && restMinutes < 600) {
            hasClopenRisk = true;
            const restHrs = Math.max(
              0,
              Math.round((restMinutes / 60) * 10) / 10
            );
            clopenDetail = `${restHrs}h rest between ${prev.type} (${prev.localDate}) & ${curr.type} (${curr.localDate})`;
          }
        } else if (dayDiff > 1) {
          currentStreak = 1;
        }
      } catch {
        // Ignore invalid date strings
      }
    }

    let equityPenalty = 0;
    if (weeklyHours > 40) equityPenalty += Math.min(35, (weeklyHours - 40) * 3);
    if (nightShiftCount > 2) equityPenalty += (nightShiftCount - 2) * 12;
    if (hasClopenRisk) equityPenalty += 25;
    if (maxStreak >= 6) equityPenalty += 15;
    const equityScore = Math.max(
      35,
      Math.min(100, Math.round(100 - equityPenalty))
    );

    let loadLevel: 'optimal' | 'elevated' | 'overloaded' = 'optimal';
    if (weeklyHours > 48 || hasClopenRisk || maxStreak >= 6) {
      loadLevel = 'overloaded';
    } else if (weeklyHours > 40 || nightShiftCount >= 3) {
      loadLevel = 'elevated';
    }

    result[userId] = {
      userId,
      weeklyHours: Math.round(weeklyHours * 10) / 10,
      consecutiveDays: maxStreak,
      hasClopenRisk,
      clopenDetail,
      nightShiftCount,
      restDayCount,
      equityScore,
      loadLevel,
      dailySparkline:
        dailySparkline.length === 7 ? dailySparkline : [0, 0, 0, 0, 0, 0, 0],
    };
  }

  return result;
}

export interface HandoffBoundaryTelemetry {
  id: '07:30' | '12:30' | '20:30';
  label: string;
  transitionTitle: string;
  outgoingWindow: string;
  incomingWindow: string;
  outgoingCount: number;
  incomingCount: number;
  activeBreakConflicts: number;
  openIncidentCount: number;
  readinessScore: number;
  status: 'ready' | 'caution' | 'critical';
}

export function computeHandoffReadiness(
  dayShifts: LocalizedShiftRecord[],
  users: UserProfile[],
  openIncidents: IncidentTicket[],
  slaMinPerWindow: number
): HandoffBoundaryTelemetry[] {
  const firstCrew = dayShifts.filter(
    (s) => categorizeShiftType(s.type) === 'first'
  );
  const secondCrew = dayShifts.filter(
    (s) => categorizeShiftType(s.type) === 'second'
  );
  const thirdCrew = dayShifts.filter(
    (s) => categorizeShiftType(s.type) === 'third'
  );

  const userBreakMap = new Map<string, boolean>();
  for (const u of users) {
    userBreakMap.set(u.uid, Boolean(u.isBreakActive));
  }

  const countBreaksInCrew = (crew: LocalizedShiftRecord[]) =>
    crew.filter((s) => userBreakMap.get(s.userId)).length;

  const boundaries: Array<{
    id: '07:30' | '12:30' | '20:30';
    label: string;
    transitionTitle: string;
    outgoingWindow: string;
    incomingWindow: string;
    outgoingCrew: LocalizedShiftRecord[];
    incomingCrew: LocalizedShiftRecord[];
  }> = [
    {
      id: '07:30',
      label: '07:30 Handoff',
      transitionTitle: '3rd Shift → 1st Shift',
      outgoingWindow: '3rd Shift',
      incomingWindow: '1st Shift',
      outgoingCrew: thirdCrew,
      incomingCrew: firstCrew,
    },
    {
      id: '12:30',
      label: '12:30 Overlap Surge',
      transitionTitle: '1st Shift + 2nd Shift',
      outgoingWindow: '1st Shift',
      incomingWindow: '2nd Shift',
      outgoingCrew: firstCrew,
      incomingCrew: secondCrew,
    },
    {
      id: '20:30',
      label: '20:30 Handoff',
      transitionTitle: '2nd Shift → 3rd Shift',
      outgoingWindow: '2nd Shift',
      incomingWindow: '3rd Shift',
      outgoingCrew: secondCrew,
      incomingCrew: thirdCrew,
    },
  ];

  return boundaries.map((b) => {
    const outgoingCount = b.outgoingCrew.length;
    const incomingCount = b.incomingCrew.length;
    const activeBreakConflicts = countBreaksInCrew(b.outgoingCrew);
    const openIncidentCount = openIncidents.length;

    let score = 100;
    if (incomingCount < slaMinPerWindow) {
      score -= 45;
    }
    if (outgoingCount < slaMinPerWindow) {
      score -= 20;
    }
    if (activeBreakConflicts > 0) {
      score -= activeBreakConflicts * 12;
    }
    if (openIncidentCount > 0) {
      score -= Math.min(25, openIncidentCount * 10);
    }

    const readinessScore = Math.max(15, Math.min(100, score));
    const status: 'ready' | 'caution' | 'critical' =
      readinessScore >= 85
        ? 'ready'
        : readinessScore >= 60
        ? 'caution'
        : 'critical';

    return {
      id: b.id,
      label: b.label,
      transitionTitle: b.transitionTitle,
      outgoingWindow: b.outgoingWindow,
      incomingWindow: b.incomingWindow,
      outgoingCount,
      incomingCount,
      activeBreakConflicts,
      openIncidentCount,
      readinessScore,
      status,
    };
  });
}

export interface AutopilotSolveResult {
  newShifts: Array<{
    userId: string;
    userName: string;
    localDate: string;
    startTime: string;
    endTime: string;
    type: string;
  }>;
  windowsFilled: number;
  restDaysAssigned: number;
}

/**
 * 1-Click Autonomous Week Autopilot Solver
 * Balances 1st, 2nd, and 3rd shifts across all 7 days of the selected week,
 * respecting <40h target load, preventing <10h clopen turnarounds, and assigning WO rest days.
 */
export function solveAutonomousWeekSchedule(
  weekDays: Date[],
  existingShifts: LocalizedShiftRecord[],
  users: UserProfile[],
  slaMinPerWindow: number
): AutopilotSolveResult {
  if (users.length === 0) {
    return { newShifts: [], windowsFilled: 0, restDaysAssigned: 0 };
  }

  const weekDates = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
  const newShifts: AutopilotSolveResult['newShifts'] = [];
  let windowsFilled = 0;
  let restDaysAssigned = 0;

  // Track each operator's assignments by date and running weekly hours
  const assignedByUserDate = new Map<string, string>(); // key: `${uid}_${date}` -> shift category
  const hoursByUser = new Map<string, number>();
  const nightCountByUser = new Map<string, number>();
  const consecutiveByUser = new Map<string, number>();

  for (const u of users) {
    hoursByUser.set(u.uid, 0);
    nightCountByUser.set(u.uid, 0);
    consecutiveByUser.set(u.uid, 0);
  }

  const weekStartStr = weekDates[0];
  const weekEndStr = weekDates[weekDates.length - 1];

  for (const s of existingShifts) {
    if (s.localDate >= weekStartStr && s.localDate <= weekEndStr) {
      const cat = categorizeShiftType(s.type);
      assignedByUserDate.set(`${s.userId}_${s.localDate}`, cat);
      const hrs = computeShiftDurationHours(
        s.localStartTime,
        s.localEndTime,
        s.type
      );
      hoursByUser.set(s.userId, (hoursByUser.get(s.userId) || 0) + hrs);
      if (cat === 'third') {
        nightCountByUser.set(s.userId, (nightCountByUser.get(s.userId) || 0) + 1);
      }
    }
  }

  const coreWindows: Array<{
    type: '1st Shift' | '2nd Shift' | '3rd Shift';
    category: ShiftCategory;
    startTime: string;
    endTime: string;
  }> = [
    {
      type: '1st Shift',
      category: 'first',
      startTime: '07:30',
      endTime: '16:30',
    },
    {
      type: '2nd Shift',
      category: 'second',
      startTime: '12:30',
      endTime: '20:30',
    },
    {
      type: '3rd Shift',
      category: 'third',
      startTime: '20:30',
      endTime: '07:30',
    },
  ];

  for (let dayIdx = 0; dayIdx < weekDates.length; dayIdx++) {
    const dateStr = weekDates[dayIdx];
    const prevDateStr = dayIdx > 0 ? weekDates[dayIdx - 1] : null;

    for (const win of coreWindows) {
      const existingInWindow = existingShifts.filter(
        (s) =>
          s.localDate === dateStr &&
          categorizeShiftType(s.type) === win.category
      ).length;
      const stagedInWindow = newShifts.filter(
        (s) =>
          s.localDate === dateStr &&
          categorizeShiftType(s.type) === win.category
      ).length;

      const deficit = Math.max(
        0,
        slaMinPerWindow - (existingInWindow + stagedInWindow)
      );

      for (let k = 0; k < deficit; k++) {
        // Rank candidates who are unassigned on dateStr and have no clopen conflict with prevDateStr
        const candidates = users
          .filter((u) => {
            if (assignedByUserDate.has(`${u.uid}_${dateStr}`)) return false;
            if (prevDateStr) {
              const prevCat = assignedByUserDate.get(`${u.uid}_${prevDateStr}`);
              // Prevent clopen: 3rd shift followed by 1st or 2nd shift, or 2nd shift followed by 1st shift
              if (
                prevCat === 'third' &&
                (win.category === 'first' || win.category === 'second')
              ) {
                return false;
              }
              if (prevCat === 'second' && win.category === 'first') {
                return false;
              }
            }
            return true;
          })
          .sort((a, b) => {
            const hrsA = hoursByUser.get(a.uid) || 0;
            const hrsB = hoursByUser.get(b.uid) || 0;
            if (hrsA !== hrsB) return hrsA - hrsB;
            if (win.category === 'third') {
              const nA = nightCountByUser.get(a.uid) || 0;
              const nB = nightCountByUser.get(b.uid) || 0;
              if (nA !== nB) return nA - nB;
            }
            return (a.displayName || '').localeCompare(b.displayName || '');
          });

        const chosen = candidates[0];
        if (!chosen) continue;

        const chosenName =
          chosen.displayName || chosen.email || 'Team Member';
        newShifts.push({
          userId: chosen.uid,
          userName: chosenName,
          localDate: dateStr,
          startTime: win.startTime,
          endTime: win.endTime,
          type: win.type,
        });
        assignedByUserDate.set(`${chosen.uid}_${dateStr}`, win.category);
        hoursByUser.set(chosen.uid, (hoursByUser.get(chosen.uid) || 0) + 8);
        if (win.category === 'third') {
          nightCountByUser.set(
            chosen.uid,
            (nightCountByUser.get(chosen.uid) || 0) + 1
          );
        }
        windowsFilled += 1;
      }
    }

    // Assign WO (Week Off) to operators who have already reached >= 40h this week and have no entry on dateStr
    for (const u of users) {
      const key = `${u.uid}_${dateStr}`;
      if (!assignedByUserDate.has(key) && (hoursByUser.get(u.uid) || 0) >= 40) {
        newShifts.push({
          userId: u.uid,
          userName: u.displayName || u.email || 'Team Member',
          localDate: dateStr,
          startTime: '00:00',
          endTime: '00:00',
          type: 'WO',
        });
        assignedByUserDate.set(key, 'off');
        restDaysAssigned += 1;
      }
    }
  }

  return { newShifts, windowsFilled, restDaysAssigned };
}

export interface WorldClockEntry {
  id: string;
  label: string;
  zone: string;
  timeStr: string;
}

export function getGlobalWorldClocks(primaryTimezone: string): WorldClockEntry[] {
  const now = new Date();
  const zones = [
    { id: 'local', label: 'LOCAL', zone: primaryTimezone || 'UTC' },
    { id: 'utc', label: 'UTC', zone: 'UTC' },
    { id: 'est', label: 'NYC', zone: 'America/New_York' },
    { id: 'lon', label: 'LDN', zone: 'Europe/London' },
    { id: 'ist', label: 'IST', zone: 'Asia/Calcutta' },
    { id: 'sgt', label: 'SGP', zone: 'Asia/Singapore' },
  ];

  return zones.map((z) => {
    try {
      const timeStr = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: z.zone,
      }).format(now);
      return { ...z, timeStr };
    } catch {
      return { ...z, timeStr: format(now, 'HH:mm') };
    }
  });
}

export interface CoverCandidate {
  user: UserProfile;
  weeklyHours: number;
  equityScore: number;
  statusNote: string;
}

export function rankCoverCandidates(
  targetShift: LocalizedShiftRecord,
  allUsers: UserProfile[],
  allShifts: LocalizedShiftRecord[],
  workloadMap: Record<string, OperatorWorkloadStats>
): CoverCandidate[] {
  const candidates: CoverCandidate[] = [];

  for (const u of allUsers) {
    if (u.uid === targetShift.userId) continue;

    const sameDayShifts = allShifts.filter(
      (s) => s.userId === u.uid && s.localDate === targetShift.localDate
    );
    const hasWorkingShiftSameDay = sameDayShifts.some(
      (s) => !isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
    );
    if (hasWorkingShiftSameDay) continue;

    const stats = workloadMap[u.uid] || {
      userId: u.uid,
      weeklyHours: 0,
      consecutiveDays: 0,
      hasClopenRisk: false,
      clopenDetail: null,
      nightShiftCount: 0,
      restDayCount: 0,
      equityScore: 100,
      loadLevel: 'optimal' as const,
      dailySparkline: [0, 0, 0, 0, 0, 0, 0],
    };

    const isOnWO = sameDayShifts.some((s) =>
      isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
    );

    candidates.push({
      user: u,
      weeklyHours: stats.weeklyHours,
      equityScore: stats.equityScore,
      statusNote: isOnWO ? 'On WO · Rested' : 'Unscheduled · Available',
    });
  }

  return candidates
    .sort((a, b) => {
      if (a.weeklyHours !== b.weeklyHours) return a.weeklyHours - b.weeklyHours;
      return b.equityScore - a.equityScore;
    })
    .slice(0, 4);
}

export function formatSecondaryTimezoneWindow(
  localDate: string,
  localStartTime: string,
  localEndTime: string,
  primaryTimezone: string,
  secondaryTimezone: string
): string {
  if (!secondaryTimezone || secondaryTimezone === 'none') return '';
  try {
    const convertSingle = (timeStr: string) => {
      const [y, m, d] = localDate.split('-').map(Number);
      const [hr, min] = timeStr.split(':').map(Number);
      const utcGuess = new Date(
        Date.UTC(y, (m || 1) - 1, d || 1, hr || 0, min || 0)
      );

      const getOffsetMs = (tz: string) => {
        const str = utcGuess.toLocaleString('en-US', { timeZone: tz });
        return new Date(str).getTime() - utcGuess.getTime();
      };

      const primOffset = getOffsetMs(primaryTimezone);
      const secOffset = getOffsetMs(secondaryTimezone);
      const shifted = new Date(utcGuess.getTime() - primOffset + secOffset);

      return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(
        shifted.getUTCMinutes()
      ).padStart(2, '0')}`;
    };

    return `${convertSingle(localStartTime)} – ${convertSingle(localEndTime)}`;
  } catch {
    return `${localStartTime} – ${localEndTime}`;
  }
}

export function getInitials(name: string): string {
  const parts = (name || 'Operator').trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }
  return (parts[0] || 'OP').slice(0, 2).toUpperCase();
}

export function downloadShiftsCSV(
  shifts: LocalizedShiftRecord[],
  userTimezone: string,
  filenamePrefix = 'shiftsync-roster'
): void {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const headers = [
    'Employee Name',
    'Local Date',
    'Shift Type',
    'Start Time',
    'End Time',
    'Duration (Hours)',
    'Timezone',
  ];
  const rows = shifts.map((s) => [
    `"${(s.userName || '').replace(/"/g, '""')}"`,
    s.localDate,
    `"${(s.type || '').replace(/"/g, '""')}"`,
    s.localStartTime,
    s.localEndTime,
    String(computeShiftDurationHours(s.localStartTime, s.localEndTime, s.type)),
    userTimezone,
  ]);
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${filenamePrefix}-${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadShiftsICS(
  shifts: LocalizedShiftRecord[],
  userTimezone: string,
  filenamePrefix = 'shiftsync-calendar'
): void {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const nowStamp = format(new Date(), "yyyyMMdd'T'HHmmss") + 'Z';

  const events = shifts.map((s) => {
    const cleanDate = (s.localDate || todayStr).replace(/-/g, '');
    const isOff = isTimeOffShift(s.type, s.localStartTime, s.localEndTime);

    if (isOff) {
      return [
        'BEGIN:VEVENT',
        `UID:shiftsync-${s.id}@shiftsync.app`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;VALUE=DATE:${cleanDate}`,
        `SUMMARY:${s.userName} — ${s.type} (Rest Day)`,
        `DESCRIPTION:ShiftSync Roster Time Off (${s.type}) · Timezone: ${userTimezone}`,
        'END:VEVENT',
      ].join('\r\n');
    }

    const startClean = (s.localStartTime || '09:00').replace(':', '') + '00';
    const endClean = (s.localEndTime || '17:00').replace(':', '') + '00';

    let endDateClean = cleanDate;
    if (parseMinutes(s.localEndTime) <= parseMinutes(s.localStartTime)) {
      try {
        endDateClean = format(addDays(parseISO(s.localDate), 1), 'yyyyMMdd');
      } catch {
        endDateClean = cleanDate;
      }
    }

    return [
      'BEGIN:VEVENT',
      `UID:shiftsync-${s.id}@shiftsync.app`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${cleanDate}T${startClean}`,
      `DTEND:${endDateClean}T${endClean}`,
      `SUMMARY:${s.userName} · ${s.type} (${s.localStartTime}–${s.localEndTime})`,
      `DESCRIPTION:ShiftSync Scheduled Shift (${s.type}) in ${userTimezone}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  const icsBody = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ShiftSync//2026 Autonomous Workforce Roster//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}-${todayStr}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
