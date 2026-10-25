import { validateDomainScope, type PolicyInputs } from '../services/schedulingPolicy';
import {
  ShiftCode,
  ShiftMetadata,
  ShiftAssignment,
  Operator,
  ScheduleScope,
  SchedulingRulesConfig,
  ValidationIssue,
  ValidationResult
} from '../data/shiftSyncTypes';

export const SHIFT_CATALOG: Record<ShiftCode, ShiftMetadata> = {
  '1ST': {
    code: '1ST',
    label: '1ST · Day',
    shortLabel: '1ST · Day',
    timeLabel: '07:30–16:30',
    startHour: 7,
    startMinute: 30,
    endHour: 16,
    endMinute: 30,
    crossesMidnight: false,
    scheduledHours: 9,
    unpaidBreakHours: 0,
    paidHours: 9,
    accentHex: '#06B6D4',
    bgClass: 'bg-[#06B6D4]/14',
    borderClass: 'border-[#06B6D4]/45',
    textClass: 'text-[#22D3EE]',
    description: 'Primary daytime floor command & grid operations (07:30–16:30 IST)'
  },
  '2ND': {
    code: '2ND',
    label: '2ND · Swing',
    shortLabel: '2ND · Swing',
    timeLabel: '12:30–20:30',
    startHour: 12,
    startMinute: 30,
    endHour: 20,
    endMinute: 30,
    crossesMidnight: false,
    scheduledHours: 8,
    unpaidBreakHours: 0,
    paidHours: 8,
    accentHex: '#10B981',
    bgClass: 'bg-[#10B981]/14',
    borderClass: 'border-[#10B981]/45',
    textClass: 'text-[#34D399]',
    description: 'Afternoon-to-evening swing watch overlapping 1ST · Day from 12:30–16:30 IST'
  },
  '3RD': {
    code: '3RD',
    label: '3RD · Night',
    shortLabel: '3RD · Night',
    timeLabel: '20:30–07:30',
    startHour: 20,
    startMinute: 30,
    endHour: 7,
    endMinute: 30,
    crossesMidnight: true,
    scheduledHours: 11,
    unpaidBreakHours: 0,
    paidHours: 11,
    accentHex: '#818CF8',
    bgClass: 'bg-[#818CF8]/16',
    borderClass: 'border-[#818CF8]/50',
    textClass: 'text-[#A5B4FC]',
    description: 'Overnight continuous watch crossing midnight (20:30–07:30 next day IST)'
  },
  GEN: {
    code: 'GEN',
    label: 'GEN · General',
    shortLabel: 'GEN · General',
    timeLabel: '09:00–18:00',
    startHour: 9,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
    crossesMidnight: false,
    scheduledHours: 9,
    unpaidBreakHours: 0,
    paidHours: 9,
    accentHex: '#F59E0B',
    bgClass: 'bg-[#F59E0B]/12',
    borderClass: 'border-[#F59E0B]/40',
    textClass: 'text-[#FBBF24]',
    description: 'Standard general engineering & coordination window (09:00–18:00 IST)'
  },
  WO: {
    code: 'WO',
    label: 'WO · Weekly Off',
    shortLabel: 'WO · Off',
    timeLabel: 'Off Roster',
    startHour: null,
    startMinute: null,
    endHour: null,
    endMinute: null,
    crossesMidnight: false,
    scheduledHours: 0,
    unpaidBreakHours: 0,
    paidHours: 0,
    accentHex: '#64748B',
    bgClass: 'bg-slate-800/70',
    borderClass: 'border-slate-700/80',
    textClass: 'text-slate-400',
    description: 'Scheduled weekly rest day (0 working hours)'
  },
  CO: {
    code: 'CO',
    label: 'CO · Compensatory Off',
    shortLabel: 'CO · Comp',
    timeLabel: 'Comp Off',
    startHour: null,
    startMinute: null,
    endHour: null,
    endMinute: null,
    crossesMidnight: false,
    scheduledHours: 0,
    unpaidBreakHours: 0,
    paidHours: 0,
    accentHex: '#06B6D4',
    bgClass: 'bg-slate-800/85',
    borderClass: 'border-[#06B6D4]/65',
    textClass: 'text-cyan-200',
    description: 'Earned compensatory rest day with cyan outline (0 working hours)'
  }
};

export function addDaysIso(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getShiftEpochBounds(
  dateStr: string,
  shiftCode: ShiftCode
): { startMs: number; endMs: number } | null {
  const meta = SHIFT_CATALOG[shiftCode];
  if (!meta || meta.startHour === null || meta.endHour === null) return null;

  const sh = String(meta.startHour).padStart(2, '0');
  const sm = String(meta.startMinute || 0).padStart(2, '0');
  const eh = String(meta.endHour).padStart(2, '0');
  const em = String(meta.endMinute || 0).padStart(2, '0');
  const endDateStr = meta.crossesMidnight ? addDaysIso(dateStr, 1) : dateStr;

  const startMs = new Date(`${dateStr}T${sh}:${sm}:00+05:30`).getTime();
  const endMs = new Date(`${endDateStr}T${eh}:${em}:00+05:30`).getTime();
  return { startMs, endMs };
}

export function computeRestHoursBetween(
  prevDate: string,
  prevShift: ShiftCode,
  nextDate: string,
  nextShift: ShiftCode
): number | null {
  const b1 = getShiftEpochBounds(prevDate, prevShift);
  const b2 = getShiftEpochBounds(nextDate, nextShift);
  if (!b1 || !b2) return null;
  const diffHours = (b2.startMs - b1.endMs) / (1000 * 60 * 60);
  return Math.round(diffHours * 10) / 10;
}

export function computeShiftProgress(
  dateStr: string,
  shiftCode: ShiftCode,
  demoNowIso: string
): {
  isActiveNow: boolean;
  elapsedPct: number;
  countdownLabel: string;
  statusLabel: string;
} {
  const bounds = getShiftEpochBounds(dateStr, shiftCode);
  if (!bounds) {
    return {
      isActiveNow: false,
      elapsedPct: 0,
      countdownLabel: 'Rest Day (0h)',
      statusLabel: 'OFF ROSTER'
    };
  }
  const nowMs = new Date(demoNowIso).getTime();
  if (nowMs < bounds.startMs) {
    const minsUntil = Math.max(0, Math.round((bounds.startMs - nowMs) / 60000));
    const h = Math.floor(minsUntil / 60);
    const m = minsUntil % 60;
    return {
      isActiveNow: false,
      elapsedPct: 0,
      countdownLabel: `Starts in ${h}h ${m}m`,
      statusLabel: 'UPCOMING SHIFT'
    };
  }
  if (nowMs >= bounds.endMs) {
    return {
      isActiveNow: false,
      elapsedPct: 100,
      countdownLabel: 'Shift Completed',
      statusLabel: 'COMPLETED'
    };
  }
  const totalMs = bounds.endMs - bounds.startMs;
  const elapsedMs = nowMs - bounds.startMs;
  const remainMins = Math.max(0, Math.round((bounds.endMs - nowMs) / 60000));
  const rh = Math.floor(remainMins / 60);
  const rm = remainMins % 60;
  const elapsedPct = Math.min(100, Math.max(1, Math.round((elapsedMs / totalMs) * 100)));

  return {
    isActiveNow: true,
    elapsedPct,
    countdownLabel: `${rh}h ${rm}m remaining`,
    statusLabel: 'ACTIVE ON FLOOR'
  };
}

export function computeOperatorWeeklySummary(
  operatorId: string,
  scopeDays: string[],
  assignments: ShiftAssignment[],
  boundaryAssignments: ShiftAssignment[] = []
): {
  totalScheduledHours: number;
  totalBreakHours: number;
  totalPaidHours: number;
  minRestHours: number;
  hasRestViolation: boolean;
  hasOvertimeAdvisory: boolean;
} {
  const daySet = new Set(scopeDays);
  const weekAssigns = assignments.filter(
    (a) => a.operatorId === operatorId && daySet.has(a.date)
  );

  let totalScheduledHours = 0;
  let totalBreakHours = 0;
  let totalPaidHours = 0;

  weekAssigns.forEach((a) => {
    const meta = SHIFT_CATALOG[a.shiftCode];
    if (meta) {
      totalScheduledHours += meta.scheduledHours;
      totalBreakHours += meta.unpaidBreakHours;
      totalPaidHours += meta.paidHours;
    }
  });

  // Sort combined assignments (including boundary dates) to compute minimum turnaround rest
  const combined = [
    ...boundaryAssignments.filter((a) => a.operatorId === operatorId && !daySet.has(a.date)),
    ...weekAssigns
  ].filter((a) => !['WO', 'CO'].includes(a.shiftCode)).sort((a, b) => a.date.localeCompare(b.date));

  let minRestHours = 99;
  for (let i = 0; i < combined.length - 1; i++) {
    const cur = combined[i];
    const nxt = combined[i + 1];
    // Only evaluate adjacent calendar days or same-week working transitions
    if (!daySet.has(cur.date) && !daySet.has(nxt.date)) continue;
    const rest = computeRestHoursBetween(cur.date, cur.shiftCode, nxt.date, nxt.shiftCode);
    if (rest !== null && rest < minRestHours) {
      minRestHours = rest;
    }
  }

  return {
    totalScheduledHours,
    totalBreakHours,
    totalPaidHours,
    minRestHours,
    hasRestViolation: minRestHours < 11,
    hasOvertimeAdvisory: totalScheduledHours > 48
  };
}

export function validateScheduleScope(
  scope: ScheduleScope,
  operators: Operator[],
  rules: SchedulingRulesConfig,
  boundaryAssignments: ShiftAssignment[] = [],
  options: Partial<PolicyInputs> = {}
): ValidationResult {
  return validateDomainScope(scope, {
    nowIso: '2026-10-25T14:00:00+05:30', requirements: [], leaveRequests: [],
    boundaryAssignments, operators, rules, ...options
  });
}
export function generateRosterCsv(
  scope: ScheduleScope,
  operators: Operator[],
  boundaryAssignments: ShiftAssignment[] = []
): string {
  const header = [
    'Operator Name',
    'Badge Code',
    'Job Title',
    'Permission Role',
    'Sector / Zone',
    'Certifications',
    ...scope.dayLabels,
    'Scheduled Hours',
    'Paid Hours',
    'Min Turnaround Rest (h)'
  ];

  const rows = operators.map((op) => {
    const summary = computeOperatorWeeklySummary(
      op.id,
      scope.days,
      scope.assignments,
      boundaryAssignments
    );
    const dayCells = scope.days.map((d) => {
      const a = scope.assignments.find((x) => x.operatorId === op.id && x.date === d);
      if (!a) return 'Unassigned';
      const meta = SHIFT_CATALOG[a.shiftCode];
      return `${a.shiftCode} (${meta.timeLabel})`;
    });

    return [
      `"${op.name}"`,
      op.badgeCode,
      `"${op.jobTitle}"`,
      op.permissionRole,
      `"${op.zone}"`,
      `"${op.certifications.join('; ')}"`,
      ...dayCells.map((c) => `"${c}"`),
      String(summary.totalScheduledHours),
      String(summary.totalPaidHours),
      summary.minRestHours === 99 ? '>=24' : String(summary.minRestHours)
    ].join(',');
  });

  return [header.join(','), ...rows].join('\n');
}

export function generateOperatorIcs(
  operator: Operator,
  assignments: ShiftAssignment[]
): string {
  // Export only working shifts (exclude WO and CO per §13)
  const working = assignments.filter(
    (a) => a.operatorId === operator.id && !['WO', 'CO'].includes(a.shiftCode)
  );

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ShiftSync AI//24-7 Workforce Operations//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:ShiftSync Roster - ${operator.name} (${operator.badgeCode})`,
    'X-WR-TIMEZONE:Asia/Kolkata'
  ];

  working.forEach((a) => {
    const meta = SHIFT_CATALOG[a.shiftCode];
    if (meta.startHour === null || meta.endHour === null) return;
    const endDate = meta.crossesMidnight ? addDaysIso(a.date, 1) : a.date;
    const sh = String(meta.startHour).padStart(2, '0');
    const sm = String(meta.startMinute || 0).padStart(2, '0');
    const eh = String(meta.endHour).padStart(2, '0');
    const em = String(meta.endMinute || 0).padStart(2, '0');

    const dtStart = `${a.date.replace(/-/g, '')}T${sh}${sm}00`;
    const dtEnd = `${endDate.replace(/-/g, '')}T${eh}${em}00`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:shiftsync-${operator.id}-${a.date}@shiftsync.ai`,
      `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
      `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
      `SUMMARY:${meta.label} (${meta.timeLabel}) - ${operator.name}`,
      `LOCATION:${a.zone}`,
      `DESCRIPTION:Operator: ${operator.name} (${operator.badgeCode})\\nShift: ${meta.label}\\nScheduled Hours: ${meta.scheduledHours}h (${meta.paidHours}h paid)`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
