import {
  PersonaProfile,
  Operator,
  ShiftAssignment,
  ScheduleScope,
  CoverageGap,
  LeaveRequest,
  ShiftTrade,
  IncidentRecord,
  HandoverSession,
  SchedulingRulesConfig,
  AuditLogEntry,
  BroadcastNotice,
  FleetUnit,
  MissionRecord,
  AppNotification,
  SavedViewPreset,
  AIProposal,
  ShiftCode
  , CoverageRequirement
} from './shiftSyncTypes';

export const PERSONAS: PersonaProfile[] = [
  {
    id: 'shift_lead',
    operatorId: 'op-alex',
    name: 'Alex Morgan',
    badgeCode: '#OP-4010',
    jobTitle: 'Shift Lead',
    permissionRole: 'Shift Lead',
    zone: 'Sector A · Core Ops',
    summary: 'Primary Watch Commander overseeing 1ST · Day and 12:30–16:30 Swing handover.'
  },
  {
    id: 'operator',
    operatorId: 'op-priya',
    name: 'Priya Nair',
    badgeCode: '#OP-4092',
    jobTitle: 'Systems Operator',
    permissionRole: 'Operator',
    zone: 'Sector A · Core Ops',
    summary: 'Primary Grid Systems Operator with L2-Grid and HV-Switch certifications.'
  },
  {
    id: 'admin',
    operatorId: 'op-elena',
    name: 'Elena Petrova',
    badgeCode: '#OP-4004',
    jobTitle: 'Operations Coordinator',
    permissionRole: 'Administrator',
    zone: 'Sector D · Dispatch',
    summary: 'Workforce Governance & Scheduling Rules Administrator.'
  }
];

const BASE_OPERATORS: Operator[] = [
  {
    id: 'op-alex',
    badgeCode: '#OP-4010',
    name: 'Alex Morgan',
    jobTitle: 'Shift Lead',
    permissionRole: 'Shift Lead',
    zone: 'Sector A · Core Ops',
    squad: 'Alpha Watch',
    certifications: ['CMD-Lead', 'L2-Grid', 'HV-Switch'],
    readinessIndex: 94,
    avatarInitials: 'AM',
    stationCoords: { x: 18, y: 22 }
  },
  {
    id: 'op-priya',
    badgeCode: '#OP-4092',
    name: 'Priya Nair',
    jobTitle: 'Systems Operator',
    permissionRole: 'Operator',
    zone: 'Sector A · Core Ops',
    squad: 'Alpha Watch',
    certifications: ['L2-Grid', 'HV-Switch', 'SCADA-Core'],
    readinessIndex: 92,
    avatarInitials: 'PN',
    stationCoords: { x: 30, y: 26 }
  },
  {
    id: 'op-marcus',
    badgeCode: '#OP-4108',
    name: 'Marcus Chen',
    jobTitle: 'Security Analyst',
    permissionRole: 'Operator',
    zone: 'Sector A · Core Ops',
    squad: 'Alpha Watch',
    certifications: ['L2-Grid', 'Cryo-Safe', 'SCADA-Core'],
    readinessIndex: 89,
    avatarInitials: 'MC',
    stationCoords: { x: 42, y: 22 }
  },
  {
    id: 'op-sofia',
    badgeCode: '#OP-4154',
    name: 'Sofia Reyes',
    jobTitle: 'Infrastructure Engineer',
    permissionRole: 'Operator',
    zone: 'Sector B · Substation',
    squad: 'Bravo Watch',
    certifications: ['L2-Grid', 'Cryo-Safe', 'HV-Switch'],
    readinessIndex: 96,
    avatarInitials: 'SR',
    stationCoords: { x: 64, y: 24 }
  },
  {
    id: 'op-james',
    badgeCode: '#OP-4201',
    name: 'James Okafor',
    jobTitle: 'Response Specialist',
    permissionRole: 'Shift Lead',
    zone: 'Sector A · Core Ops',
    squad: 'Bravo Watch',
    certifications: ['CMD-Lead', 'L2-Grid', 'SCADA-Core'],
    readinessIndex: 93,
    avatarInitials: 'JO',
    stationCoords: { x: 24, y: 38 }
  },
  {
    id: 'op-elena',
    badgeCode: '#OP-4004',
    name: 'Elena Petrova',
    jobTitle: 'Operations Coordinator',
    permissionRole: 'Administrator',
    zone: 'Sector D · Dispatch',
    squad: 'Command Admin',
    certifications: ['CMD-Lead', 'Dispatch-L3', 'SCADA-Core'],
    readinessIndex: 95,
    avatarInitials: 'EP',
    stationCoords: { x: 76, y: 74 }
  },
  {
    id: 'op-rohan',
    badgeCode: '#OP-4119',
    name: 'Rohan Deshmukh',
    jobTitle: 'Night Watch Lead',
    permissionRole: 'Shift Lead',
    zone: 'Sector B · Substation',
    squad: 'Charlie Night',
    certifications: ['CMD-Lead', 'HV-Switch', 'Cryo-Safe'],
    readinessIndex: 90,
    avatarInitials: 'RD',
    stationCoords: { x: 78, y: 24 }
  },
  {
    id: 'op-aditi',
    badgeCode: '#OP-4127',
    name: 'Aditi Kulkarni',
    jobTitle: 'Substation Operator',
    permissionRole: 'Operator',
    zone: 'Sector B · Substation',
    squad: 'Charlie Night',
    certifications: ['HV-Switch', 'Cryo-Safe'],
    readinessIndex: 91,
    avatarInitials: 'AK',
    stationCoords: { x: 86, y: 36 }
  },
  {
    id: 'op-pranav',
    badgeCode: '#OP-4133',
    name: 'Pranav Saxena',
    jobTitle: 'Telemetry Analyst',
    permissionRole: 'Operator',
    zone: 'Sector C · Telemetry',
    squad: 'Charlie Night',
    certifications: ['SCADA-Core', 'L2-Grid', 'Cryo-Safe'],
    readinessIndex: 88,
    avatarInitials: 'PS',
    stationCoords: { x: 22, y: 72 }
  },
  {
    id: 'op-kavya',
    badgeCode: '#OP-4140',
    name: 'Kavya Menon',
    jobTitle: 'Systems Operator',
    permissionRole: 'Operator',
    zone: 'Sector A · Core Ops',
    squad: 'Alpha Watch',
    certifications: ['L2-Grid', 'SCADA-Core'],
    readinessIndex: 93,
    avatarInitials: 'KM',
    stationCoords: { x: 36, y: 38 }
  },
  {
    id: 'op-vikram',
    badgeCode: '#OP-4148',
    name: 'Vikram Rathore',
    jobTitle: 'Substation Engineer',
    permissionRole: 'Operator',
    zone: 'Sector B · Substation',
    squad: 'Alpha Watch',
    certifications: ['HV-Switch', 'L2-Grid'],
    readinessIndex: 91,
    avatarInitials: 'VR',
    stationCoords: { x: 60, y: 38 }
  },
  {
    id: 'op-neha',
    badgeCode: '#OP-4162',
    name: 'Neha Sharma',
    jobTitle: 'Telemetry Operator',
    permissionRole: 'Operator',
    zone: 'Sector C · Telemetry',
    squad: 'Alpha Watch',
    certifications: ['SCADA-Core', 'L2-Grid'],
    readinessIndex: 94,
    avatarInitials: 'NS',
    stationCoords: { x: 34, y: 72 }
  },
  {
    id: 'op-arjun',
    badgeCode: '#OP-4170',
    name: 'Arjun Verma',
    jobTitle: 'Dispatch Controller',
    permissionRole: 'Operator',
    zone: 'Sector D · Dispatch',
    squad: 'Alpha Watch',
    certifications: ['Dispatch-L3', 'SCADA-Core'],
    readinessIndex: 92,
    avatarInitials: 'AV',
    stationCoords: { x: 64, y: 74 }
  },
  {
    id: 'op-zoya',
    badgeCode: '#OP-4178',
    name: 'Zoya Khan',
    jobTitle: 'Systems Operator',
    permissionRole: 'Operator',
    zone: 'Sector A · Core Ops',
    squad: 'Bravo Watch',
    certifications: ['L2-Grid', 'HV-Switch'],
    readinessIndex: 95,
    avatarInitials: 'ZK',
    stationCoords: { x: 16, y: 42 }
  },
  {
    id: 'op-kabir',
    badgeCode: '#OP-4185',
    name: 'Kabir Gill',
    jobTitle: 'Substation Operator',
    permissionRole: 'Operator',
    zone: 'Sector B · Substation',
    squad: 'Bravo Watch',
    certifications: ['HV-Switch', 'Cryo-Safe'],
    readinessIndex: 90,
    avatarInitials: 'KG',
    stationCoords: { x: 72, y: 40 }
  },
  {
    id: 'op-meera',
    badgeCode: '#OP-4191',
    name: 'Meera Joshi',
    jobTitle: 'Telemetry Specialist',
    permissionRole: 'Operator',
    zone: 'Sector C · Telemetry',
    squad: 'Bravo Watch',
    certifications: ['SCADA-Core', 'L2-Grid'],
    readinessIndex: 93,
    avatarInitials: 'MJ',
    stationCoords: { x: 44, y: 76 }
  },
  {
    id: 'op-devansh',
    badgeCode: '#OP-4199',
    name: 'Devansh Mehta',
    jobTitle: 'Grid Operator',
    permissionRole: 'Operator',
    zone: 'Sector A · Core Ops',
    squad: 'Bravo Watch',
    certifications: ['L2-Grid', 'SCADA-Core'],
    readinessIndex: 89,
    avatarInitials: 'DM',
    stationCoords: { x: 28, y: 44 }
  },
  {
    id: 'op-tanya',
    badgeCode: '#OP-4208',
    name: 'Tanya Bhatia',
    jobTitle: 'Substation Specialist',
    permissionRole: 'Operator',
    zone: 'Sector B · Substation',
    squad: 'Bravo Watch',
    certifications: ['HV-Switch', 'L2-Grid'],
    readinessIndex: 92,
    avatarInitials: 'TB',
    stationCoords: { x: 84, y: 22 }
  },
  {
    id: 'op-siddharth',
    badgeCode: '#OP-4215',
    name: 'Siddharth Rao',
    jobTitle: 'Systems Operator',
    permissionRole: 'Operator',
    zone: 'Sector A · Core Ops',
    squad: 'Alpha Watch',
    certifications: ['L2-Grid', 'HV-Switch'],
    readinessIndex: 91,
    avatarInitials: 'SR',
    stationCoords: { x: 44, y: 36 }
  },
  {
    id: 'op-isha',
    badgeCode: '#OP-4222',
    name: 'Isha Sengupta',
    jobTitle: 'Systems Operator',
    permissionRole: 'Operator',
    zone: 'Sector A · Core Ops',
    squad: 'Bravo Watch',
    certifications: ['L2-Grid', 'SCADA-Core'],
    readinessIndex: 94,
    avatarInitials: 'IS',
    stationCoords: { x: 20, y: 30 }
  },
  {
    id: 'op-nikhil',
    badgeCode: '#OP-4230',
    name: 'Nikhil Pillai',
    jobTitle: 'Substation Operator',
    permissionRole: 'Operator',
    zone: 'Sector B · Substation',
    squad: 'Alpha Watch',
    certifications: ['HV-Switch', 'Cryo-Safe'],
    readinessIndex: 90,
    avatarInitials: 'NP',
    stationCoords: { x: 66, y: 32 }
  },
  {
    id: 'op-ananya',
    badgeCode: '#OP-4238',
    name: 'Ananya Chatterjee',
    jobTitle: 'Compliance & Grid Analyst',
    permissionRole: 'Operator',
    zone: 'Sector C · Telemetry',
    squad: 'Command Admin',
    certifications: ['SCADA-Core', 'Dispatch-L3'],
    readinessIndex: 95,
    avatarInitials: 'AC',
    stationCoords: { x: 18, y: 82 }
  }
];

export const INITIAL_OPERATORS: Operator[] = [...BASE_OPERATORS, ...['Noor Ali', 'Daniel Park', 'Ava Bennett', 'Omar Hassan', 'Maya Rao', 'Leo Silva'].map((name, index): Operator => ({
  id: `op-relief-${index}`, badgeCode: `#OP-43${String(index).padStart(2, '0')}`, name,
  jobTitle: 'Relief Infrastructure Engineer', permissionRole: 'Operator', zone: 'Sector B · Substation', squad: 'Relief Watch',
  certifications: ['Cryo-Safe', 'HV-Switch', 'L2-Grid'], readinessIndex: 92, avatarInitials: name.split(' ').map((part) => part[0]).join(''), stationCoords: { x: 60 + index * 4, y: 48 }
}))];

const WEEK_1_DAYS = [
  '2026-10-19',
  '2026-10-20',
  '2026-10-21',
  '2026-10-22',
  '2026-10-23',
  '2026-10-24',
  '2026-10-25'
];

const WEEK_1_LABELS = [
  'Mon 19 Oct',
  'Tue 20 Oct',
  'Wed 21 Oct',
  'Thu 22 Oct',
  'Fri 23 Oct',
  'Sat 24 Oct',
  'Sun 25 Oct'
];

const WEEK_2_DAYS = [
  '2026-10-26',
  '2026-10-27',
  '2026-10-28',
  '2026-10-29',
  '2026-10-30',
  '2026-10-31',
  '2026-11-01'
];

const WEEK_2_LABELS = [
  'Mon 26 Oct',
  'Tue 27 Oct',
  'Wed 28 Oct',
  'Thu 29 Oct',
  'Fri 30 Oct',
  'Sat 31 Oct',
  'Sun 01 Nov'
];

/**
 * Exact 7-day shift patterns for all 22 operators in 19–25 Oct 2026 so that:
 * 1) On Sunday 25 Oct 2026 at 14:00 IST:
 *    - 9 operators are on 1ST · Day (07:30–16:30)
 *    - 7 operators are on 2ND · Swing (12:30–20:30)
 *    - 2 operators are on GEN · General (09:00–18:00)
 *    -> Total active on floor at 14:00 IST = 9 + 7 + 2 = 18 / 20 positions staffed (90%), 2 preferred openings, hard min 18 met!
 *    - 3 operators are on 3RD · Night (20:30–07:30)
 *    - 1 operator (Sofia Reyes) is on WO · Weekly Off (eligible to fill the upcoming 3RD · Night coverage gap!)
 * 2) Every operator has 0 turnaround violations (<11h rest) and <= 48h weekly scheduled hours.
 */
const WEEK_1_PATTERNS: Record<string, ShiftCode[]> = {
  // 9 operators on 1ST on Sunday 25 Oct (5 working days x 9h = 45h/wk)
  'op-alex': ['1ST', '1ST', 'WO', 'WO', '1ST', '1ST', '1ST'],
  'op-priya': ['1ST', '1ST', '1ST', 'WO', 'WO', '1ST', '1ST'],
  'op-marcus': ['WO', '1ST', '1ST', '1ST', 'WO', '1ST', '1ST'],
  'op-kavya': ['1ST', 'WO', '1ST', '1ST', '1ST', 'WO', '1ST'],
  'op-vikram': ['1ST', '1ST', 'WO', '1ST', '1ST', 'WO', '1ST'],
  'op-neha': ['WO', '1ST', '1ST', 'WO', '1ST', '1ST', '1ST'],
  'op-arjun': ['1ST', 'WO', 'WO', '1ST', '1ST', '1ST', '1ST'],
  'op-siddharth': ['1ST', '1ST', '1ST', 'WO', '1ST', 'WO', '1ST'],
  'op-nikhil': ['WO', 'CO', '1ST', '1ST', '1ST', '1ST', '1ST'],

  // 7 operators on 2ND on Sunday 25 Oct (5 working days x 8h = 40h/wk)
  'op-james': ['2ND', '2ND', 'WO', 'WO', '2ND', '2ND', '2ND'],
  'op-zoya': ['2ND', 'WO', '2ND', '2ND', 'WO', '2ND', '2ND'],
  'op-kabir': ['WO', '2ND', '2ND', 'WO', '2ND', '2ND', '2ND'],
  'op-meera': ['2ND', '2ND', 'WO', '2ND', '2ND', 'WO', '2ND'],
  'op-devansh': ['WO', '2ND', '2ND', '2ND', 'WO', '2ND', '2ND'],
  'op-tanya': ['2ND', 'WO', 'WO', '2ND', '2ND', '2ND', '2ND'],
  'op-isha': ['2ND', '2ND', '2ND', 'WO', 'WO', '2ND', '2ND'],

  // 2 operators on GEN on Sunday 25 Oct (5 working days x 9h = 45h/wk)
  'op-elena': ['GEN', 'GEN', 'WO', 'WO', 'GEN', 'GEN', 'GEN'],
  'op-ananya': ['WO', 'GEN', 'GEN', 'GEN', 'WO', 'GEN', 'GEN'],

  // 3 operators on 3RD · Night on Sunday 25 Oct (4 working nights x 11h = 44h/wk)
  'op-rohan': ['3RD', '3RD', 'WO', 'WO', 'WO', '3RD', '3RD'],
  'op-aditi': ['WO', '3RD', '3RD', 'WO', 'WO', '3RD', '3RD'],
  'op-pranav': ['3RD', 'WO', 'WO', '3RD', '3RD', 'WO', '3RD'],

  // 1 operator on WO on Sunday 25 Oct (Sofia Reyes: 4 working days x 9h = 36h/wk, rested & eligible for 3RD Night!)
  'op-sofia': ['1ST', '1ST', '1ST', '1ST', 'WO', 'WO', 'WO']
};

const WEEK_2_PATTERNS: Record<string, ShiftCode[]> = {
  'op-alex': ['1ST', '1ST', '1ST', 'WO', 'WO', '1ST', '1ST'],
  'op-priya': ['1ST', '1ST', '1ST', '1ST', 'WO', 'WO', '1ST'],
  'op-marcus': ['1ST', '1ST', '1ST', 'WO', '1ST', '1ST', 'WO'],
  'op-sofia': ['WO', 'WO', '2ND', '2ND', '2ND', '2ND', 'WO'],
  'op-james': ['2ND', '2ND', '2ND', '2ND', 'WO', 'WO', '2ND'],
  'op-elena': ['GEN', 'GEN', 'GEN', 'GEN', 'GEN', 'WO', 'WO'],
  'op-rohan': ['3RD', '3RD', 'WO', 'WO', '3RD', '3RD', 'WO'],
  'op-aditi': ['3RD', 'WO', 'WO', '3RD', '3RD', 'WO', '3RD'],
  'op-pranav': ['WO', '3RD', '3RD', 'WO', 'WO', '3RD', '3RD'],
  'op-kavya': ['1ST', '1ST', 'WO', '1ST', '1ST', '1ST', 'WO'],
  'op-vikram': ['1ST', 'WO', '1ST', '1ST', '1ST', 'WO', '1ST'],
  'op-neha': ['WO', '1ST', '1ST', '1ST', 'WO', '1ST', '1ST'],
  'op-arjun': ['1ST', '1ST', 'WO', 'WO', '1ST', '1ST', '1ST'],
  'op-zoya': ['2ND', '2ND', 'WO', '2ND', '2ND', '2ND', 'WO'],
  'op-kabir': ['2ND', 'WO', '2ND', '2ND', 'WO', '2ND', '2ND'],
  'op-meera': ['WO', '2ND', '2ND', '2ND', '2ND', 'WO', '2ND'],
  'op-devansh': ['2ND', '2ND', '2ND', 'WO', '2ND', 'WO', '2ND'],
  'op-tanya': ['WO', '2ND', 'WO', '2ND', '2ND', '2ND', '2ND'],
  'op-siddharth': ['1ST', 'WO', '1ST', '1ST', '1ST', '1ST', 'WO'],
  'op-isha': ['2ND', '2ND', 'WO', 'WO', '2ND', '2ND', '2ND'],
  'op-nikhil': ['1ST', '1ST', '1ST', 'WO', 'WO', '1ST', '1ST'],
  'op-ananya': ['GEN', 'GEN', 'WO', 'GEN', 'GEN', 'GEN', 'WO']
};

function buildAssignmentsForWeek(
  days: string[],
  patterns: Record<string, ShiftCode[]>
): ShiftAssignment[] {
  const list: ShiftAssignment[] = [];
  INITIAL_OPERATORS.forEach((op) => {
    const pat = patterns[op.id] || ['WO', 'WO', 'WO', 'WO', 'WO', 'WO', 'WO'];
    days.forEach((d, idx) => {
      list.push({
        operatorId: op.id,
        date: d,
        shiftCode: pat[idx],
        zone: pat[idx] === '3RD' ? 'Sector B · Substation' : op.zone,
        requiredCert: pat[idx] === '3RD' ? 'Cryo-Safe' : undefined,
        availability: 'present',
        locked: op.id === 'op-alex' && d === '2026-10-25',
        isDraftChanged: false
      });
    });
  });
  days.forEach((date, dayIndex) => {
    let nightCount = list.filter((assignment) => assignment.date === date && assignment.shiftCode === '3RD').length;
    for (let offset = 0; nightCount < 3 && offset < 6; offset += 1) {
      const id = `op-relief-${(dayIndex + offset) % 6}`;
      const assignment = list.find((item) => item.operatorId === id && item.date === date);
      if (assignment) { assignment.shiftCode = '3RD'; assignment.requiredCert = 'Cryo-Safe'; nightCount += 1; }
    }
  });
  return list;
}

const week1Assignments = buildAssignmentsForWeek(WEEK_1_DAYS, WEEK_1_PATTERNS);
const week2Assignments = buildAssignmentsForWeek(WEEK_2_DAYS, WEEK_2_PATTERNS);

// Boundary assignments (Sun 18 Oct 2026) so cross-week rest checks are accurate
export const BOUNDARY_ASSIGNMENTS: ShiftAssignment[] = ['2026-10-18', '2026-11-02', '2026-11-03'].flatMap((date) => INITIAL_OPERATORS.map((op): ShiftAssignment => ({
  operatorId: op.id,
  date,
  shiftCode: 'WO',
  zone: op.zone,
  locked: true
})));

export const INITIAL_SCOPES: Record<string, ScheduleScope> = {
  'scope-2026-10-19': {
    id: 'scope-2026-10-19',
    label: '19–25 October 2026',
    startDate: '2026-10-19',
    endDate: '2026-10-25',
    days: WEEK_1_DAYS,
    dayLabels: WEEK_1_LABELS,
    version: 'v2.4',
    status: 'Published',
    publishedAtIso: '2026-10-24T18:00:00+05:30',
    publishedBy: 'Alex Morgan (Shift Lead)',
    assignments: week1Assignments.map((a) => ({ ...a })),
    publishedAssignments: week1Assignments.map((a) => ({ ...a }))
  },
  'scope-2026-10-26': {
    id: 'scope-2026-10-26',
    label: '26 Oct–1 Nov 2026',
    startDate: '2026-10-26',
    endDate: '2026-11-01',
    days: WEEK_2_DAYS,
    dayLabels: WEEK_2_LABELS,
    version: 'v3.0-draft',
    status: 'Published',
    publishedAtIso: '2026-10-25T10:00:00+05:30',
    publishedBy: 'Elena Petrova (Operations Coordinator)',
    assignments: week2Assignments.map((a) => ({ ...a })),
    publishedAssignments: week2Assignments.map((a) => ({ ...a }))
  }
};

export const INITIAL_COVERAGE_REQUIREMENTS: CoverageRequirement[] = Object.values(INITIAL_SCOPES).flatMap((scope) => scope.days.flatMap((date) => {
  const nightly: CoverageRequirement = { id: `night-${date}`, date, shiftCode: '3RD', zone: 'Sector B · Substation', role: 'Certified Night position', requiredCert: 'Cryo-Safe', hardMinimum: 3, preferredTarget: 4 };
  const daytime: CoverageRequirement[] = ['1ST', '2ND', 'GEN'].flatMap((code) => [...new Set(INITIAL_OPERATORS.map((operator) => operator.zone))].flatMap((zone) => {
    const count = scope.assignments.filter((assignment) => assignment.date === date && assignment.shiftCode === code && assignment.zone === zone).length;
    return count ? [{ id: `${date}-${code}-${zone}`, date, shiftCode: code as ShiftCode, zone, role: 'Scheduled operations position', hardMinimum: count, preferredTarget: count }] : [];
  }));
  return [nightly, ...daytime];
}));
INITIAL_COVERAGE_REQUIREMENTS.push({ id: 'baseline-overlap', date: '2026-10-25', shiftCode: '1ST', zone: 'ALL', role: 'Facility overlap floor', hardMinimum: 18, preferredTarget: 20, startIso: '2026-10-25T12:30:00+05:30', endIso: '2026-10-25T16:30:00+05:30' });

export const INITIAL_COVERAGE_GAPS: CoverageGap[] = [
  {
    id: 'GAP-2026-1025-N',
    date: '2026-10-25',
    shiftCode: '3RD',
    zone: 'Sector B · Substation',
    roleRequired: 'Cryo & Power Specialist',
    requiredCert: 'Cryo-Safe',
    preferredTarget: 4,
    hardMinimum: 3,
    currentStaffed: 3,
    severity: 'advisory',
    reason:
      'Upcoming 3RD · Night (20:30–07:30 next day) meets hard minimum (3/3) but has 1 open preferred slot in Sector B · Substation.',
    candidates: [
      {
        operatorId: 'op-sofia',
        restHoursBefore: 52,
        projectedWeeklyHours: 47,
        certMatch: true,
        availabilityStatus: 'Available (Currently on WO · Weekly Off)',
        overtimeImpactHours: 0,
        fairnessDelta: '+1.2%',
        ineligibleReason: null
      },
      {
        operatorId: 'op-marcus',
        restHoursBefore: 4.0,
        projectedWeeklyHours: 56,
        certMatch: true,
        availabilityStatus: 'On 1ST · Day (07:30–16:30) today',
        overtimeImpactHours: 8,
        fairnessDelta: '-3.4%',
        ineligibleReason:
          'Turnaround violation: Only 4.0h rest between 1ST end (16:30) and 3RD start (20:30); minimum required is 11h.'
      },
      {
        operatorId: 'op-devansh',
        restHoursBefore: 0,
        projectedWeeklyHours: 51,
        certMatch: false,
        availabilityStatus: 'On 2ND · Swing (12:30–20:30) today',
        overtimeImpactHours: 3,
        fairnessDelta: '-2.1%',
        ineligibleReason:
          '0h rest turnaround after 2ND · Swing (ends 20:30) and missing required Cryo-Safe certification.'
      }
    ]
  }
];

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'LR-2026-109',
    operatorId: 'op-priya',
    leaveType: 'Annual Leave',
    startDate: '2026-10-27',
    endDate: '2026-10-27',
    reason: 'Family medical appointment in Bengaluru; station handover notes prepared for Sector A.',
    status: 'Pending Approval',
    submittedAtIso: '2026-10-25T11:20:00+05:30',
    affectedShift: '1ST',
    coverageImpactSummary:
      'Impacts Tue 27 Oct 1ST · Day (07:30–16:30) in Sector A · Core Ops. Sofia Reyes (#OP-4154) and Zoya Khan (#OP-4178) are available with >=11h rest.'
  }
];

export const INITIAL_SHIFT_TRADES: ShiftTrade[] = [
  {
    id: 'TR-2026-304',
    requesterId: 'op-marcus',
    requesterDate: '2026-10-28',
    requesterShift: '1ST',
    partnerId: 'op-james',
    partnerDate: '2026-10-28',
    partnerShift: '2ND',
    status: 'Supervisor Review',
    reason:
      'Bilateral swap on Wed 28 Oct: Marcus Chen takes 2ND · Swing (12:30–20:30) and James Okafor takes 1ST · Day (07:30–16:30).',
    submittedAtIso: '2026-10-25T12:10:00+05:30',
    validationPassed: true,
    validationNotes: [
      'Both operators hold L2-Grid and SCADA-Core certifications for Sector A.',
      'Turnaround rest check passed: >=15h rest before and after swapped shifts.',
      'Weekly scheduled hours remain <= 45h for both operators.'
    ]
  }
];

export const INITIAL_INCIDENTS: IncidentRecord[] = [
  {
    id: 'INC-2026-841',
    title: 'Telemetry Bus-B Secondary Relay Harmonic Drift',
    severity: 'L2 · Elevated',
    status: 'Mitigating',
    zone: 'Sector A · Core Ops',
    ownerOperatorId: 'op-priya',
    openedAtIso: '2026-10-25T13:15:00+05:30',
    summary:
      'Secondary telemetry relay exhibited 4.2ms phase jitter during 13:15 IST load transfer. Redundant Bus-A active with zero packet loss.',
    outcomeNote:
      'Isolated Bus-B secondary channel and switched polling to Bus-A redundant path. Ready for final closure verification.',
    carryToHandover: true,
    checklist: [
      {
        id: 'st-1',
        label: 'Failover Sector A telemetry polling to redundant Bus-A channel',
        completed: true,
        completedAtIso: '13:19 IST'
      },
      {
        id: 'st-2',
        label: 'Run 15-minute harmonic damping diagnostic on Bus-B relay',
        completed: true,
        completedAtIso: '13:38 IST'
      },
      {
        id: 'st-3',
        label: 'Verify phase jitter < 0.5ms and log closure note for Swing Lead handover',
        completed: false
      }
    ]
  },
  {
    id: 'INC-2026-839',
    title: 'Substation Cryo Loop-2 Pressure Sensor Calibration Advisory',
    severity: 'L1 · Minor',
    status: 'Open',
    zone: 'Sector B · Substation',
    ownerOperatorId: 'op-vikram',
    openedAtIso: '2026-10-25T11:40:00+05:30',
    summary:
      'Sensor PSI-204 reading +0.8% offset from primary manifold gauge. Scheduled for in-situ zeroing during 12:30–16:30 overlap.',
    outcomeNote: '',
    carryToHandover: true,
    checklist: [
      {
        id: 'st-201',
        label: 'Cross-check PSI-204 against primary manifold reference gauge',
        completed: true,
        completedAtIso: '12:05 IST'
      },
      {
        id: 'st-202',
        label: 'Apply zero-offset trim in SCADA calibration console',
        completed: false
      }
    ]
  }
];

export const INITIAL_HANDOVER_SESSION: HandoverSession = {
  id: 'HO-2026-1025-DS',
  date: '2026-10-25',
  outgoingShift: '1ST',
  incomingShift: '2ND',
  overlapWindowLabel: '12:30–16:30 IST (4h Overlap)',
  outgoingLeadName: 'Alex Morgan (#OP-4010)',
  incomingLeadName: 'James Okafor (#OP-4201)',
  systemUptimePct: 99.98,
  openTicketsCount: 2,
  keyFobTransferred: true,
  summaryNote:
    '18/20 floor positions staffed at 14:00 IST. Bus-B harmonic drift mitigated on redundant Bus-A. Night shift coverage candidate (Sofia Reyes) ready for assignment.',
  status: 'In Progress (Overlap Active)'
};

export const INITIAL_RULES_CONFIG: SchedulingRulesConfig = {
  minRestHours: 11,
  weeklyHoursAdvisoryLimit: 48,
  hardMinimumFloorCoverage: 18,
  preferredFloorTarget: 20,
  requireCertMatch: true,
  allowOvernightBackToBack: false
};

export const INITIAL_AUDIT_LOG: AuditLogEntry[] = [
  {
    id: 'AUD-9042',
    timestampIso: '2026-10-24T18:00:00+05:30',
    actorName: 'Alex Morgan',
    actorRole: 'Shift Lead',
    action: 'Schedule Published (v2.4)',
    scope: '19–25 October 2026',
    detail: 'Published validated weekly roster with 0 turnaround violations and 96% squad rotation equity.',
    severity: 'info'
  },
  {
    id: 'AUD-9038',
    timestampIso: '2026-10-24T15:10:00+05:30',
    actorName: 'Elena Petrova',
    actorRole: 'Administrator',
    action: 'Guardrail Policy Verified',
    scope: 'Global Scheduling Rules',
    detail: 'Confirmed minimum turnaround rest at 11.0h and weekly advisory threshold at 48.0h.',
    severity: 'info'
  }
];

export const INITIAL_BROADCASTS: BroadcastNotice[] = [
  {
    id: 'BC-104',
    title: 'Day-to-Swing Overlap Window Active (12:30–16:30 IST)',
    message:
      'All Sector A and Sector B leads please complete incident runbook verification and key-fob audit prior to 16:15 IST.',
    severity: 'info',
    targetZone: 'All Floor Sectors',
    sentBy: 'Alex Morgan (Shift Lead)',
    sentAtIso: '2026-10-25T12:30:00+05:30'
  }
];

export const INITIAL_FLEET_UNITS: FleetUnit[] = [
  {
    id: 'AGV-01',
    name: 'Cryo-Inspector Rover Alpha',
    zone: 'Sector B · Substation',
    status: 'Nominal',
    batteryPct: 88,
    assignedOperatorId: 'op-vikram'
  },
  {
    id: 'AGV-02',
    name: 'Bus-Bar Thermal Drone B2',
    zone: 'Sector A · Core Ops',
    status: 'Nominal',
    batteryPct: 94,
    assignedOperatorId: 'op-priya'
  },
  {
    id: 'AGV-03',
    name: 'Substation Relay Probe C1',
    zone: 'Sector C · Telemetry',
    status: 'Calibration',
    batteryPct: 76,
    assignedOperatorId: 'op-neha'
  }
];

export const INITIAL_MISSIONS: MissionRecord[] = [
  {
    id: 'MSN-901',
    title: '12:30–16:30 Overlap Grid Load Balancing',
    zone: 'Sector A · Core Ops',
    leadOperatorId: 'op-alex',
    status: 'In Progress',
    etaLabel: '16:00 IST'
  },
  {
    id: 'MSN-902',
    title: 'Substation Cryo Loop-2 Sensor Trim',
    zone: 'Sector B · Substation',
    leadOperatorId: 'op-vikram',
    status: 'In Progress',
    etaLabel: '15:15 IST'
  },
  {
    id: 'MSN-903',
    title: 'Pre-Night Watch Relay Readiness Sweep',
    zone: 'Sector C · Telemetry',
    leadOperatorId: 'op-james',
    status: 'Scheduled',
    etaLabel: '19:30 IST'
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-101',
    title: 'Upcoming 3RD · Night Preferred Slot Open',
    body: 'Sun 25 Oct 20:30–07:30 has 1 open preferred slot in Sector B. Sofia Reyes (#OP-4154) is eligible with 52h rest.',
    timestampIso: '2026-10-25T13:45:00+05:30',
    read: false,
    category: 'coverage',
    linkWorkspace: 'schedule'
  },
  {
    id: 'notif-102',
    title: '2 Pending Approvals in Alert Desk',
    body: 'Leave Request LR-2026-109 (Priya Nair) and Atomic Trade TR-2026-304 (Marcus Chen ↔ James Okafor).',
    timestampIso: '2026-10-25T13:20:00+05:30',
    read: false,
    category: 'approval',
    linkWorkspace: 'requests'
  },
  {
    id: 'notif-103',
    title: 'Roster v2.4 Published & Active',
    body: '19–25 October 2026 schedule is live with 18/20 floor positions staffed at 14:00 IST.',
    timestampIso: '2026-10-24T18:00:00+05:30',
    read: true,
    category: 'publication',
    linkWorkspace: 'overview'
  }
];

export const INITIAL_SAVED_VIEWS: SavedViewPreset[] = [
  {
    id: 'sv-1',
    name: 'All Active Floor Squads',
    workspace: 'schedule',
    subView: 'roster_table',
    filters: { zone: 'ALL', shiftCode: 'ALL' }
  },
  {
    id: 'sv-2',
    name: 'Sector A · Core Ops (1ST · Day)',
    workspace: 'schedule',
    subView: 'roster_table',
    filters: { zone: 'Sector A · Core Ops', shiftCode: '1ST' }
  },
  {
    id: 'sv-3',
    name: '12:30–16:30 Overlap Timeline',
    workspace: 'schedule',
    subView: 'timeline_24h',
    filters: { zone: 'ALL', shiftCode: 'ALL' }
  }
];

export function buildDefaultAIProposal(): AIProposal {
  return {
    id: `AIP-${Date.now().toString().slice(-4)}`,
    scopeId: 'scope-2026-10-26',
    generatedAtIso: new Date().toISOString(),
    title: 'Autonomous Week Autopilot · 26 Oct–1 Nov 2026',
    summary:
      'Optimized next-week draft roster across all 22 operators: covers Priya Nair’s requested Tue 27 Oct leave, balances night watch load, and maintains 0 turnaround violations.',
    fairnessScorePct: 96,
    turnaroundViolations: 0,
    HardGapsRemaining: 0,
    proposedChanges: [
      {
        operatorId: 'op-sofia',
        operatorName: 'Sofia Reyes (#OP-4154)',
        date: '2026-10-27',
        fromShift: 'WO',
        toShift: '1ST',
        zone: 'Sector A · Core Ops',
        rationale:
          'Covers Priya Nair’s Tue 27 Oct 1ST · Day (07:30–16:30) slot with 36h prior rest and full L2-Grid certification.'
      },
      {
        operatorId: 'op-zoya',
        operatorName: 'Zoya Khan (#OP-4178)',
        date: '2026-10-28',
        fromShift: 'WO',
        toShift: '2ND',
        zone: 'Sector A · Core Ops',
        rationale:
          'Balances 12:30–16:30 Day/Swing handover overlap headcount on Wed 28 Oct while keeping weekly hours at 44h.'
      },
      {
        operatorId: 'op-aditi',
        operatorName: 'Aditi Kulkarni (#OP-4127)',
        date: '2026-10-28',
        fromShift: 'WO',
        toShift: '3RD',
        zone: 'Sector B · Substation',
        rationale:
          'Brings Sector B 3RD · Night (20:30–07:30) to full preferred target (4/4) with 24h prior turnaround rest.'
      }
    ]
  };
}
