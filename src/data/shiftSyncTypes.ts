export type ShiftCode = '1ST' | '2ND' | '3RD' | 'GEN' | 'WO' | 'CO';

export type PersonaId = 'shift_lead' | 'operator' | 'admin';

export type WorkspaceId =
  | 'overview'
  | 'needs_attention'
  | 'schedule'
  | 'live_floor'
  | 'requests'
  | 'incidents'
  | 'operators'
  | 'administration'
  | 'component_board';

export type ScheduleSubView =
  | 'roster_table'
  | 'week_grid'
  | 'coverage_matrix'
  | 'timeline_24h';

export type LeavesSubView =
  | 'requests'
  | 'shift_trades'
  | 'team_calendar'
  | 'my_requests';

export type IncidentsSubView = 'incidents' | 'handover';

export type AdminSubView =
  | 'members_roles'
  | 'scheduling_rules'
  | 'audit_log'
  | 'broadcasts'
  | 'integrations';

export interface ShiftMetadata {
  code: ShiftCode;
  label: string;
  shortLabel: string;
  timeLabel: string;
  startHour: number | null;
  startMinute: number | null;
  endHour: number | null;
  endMinute: number | null;
  crossesMidnight: boolean;
  scheduledHours: number;
  unpaidBreakHours: number;
  paidHours: number;
  accentHex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  description: string;
}

export interface PersonaProfile {
  id: PersonaId;
  operatorId: string;
  name: string;
  badgeCode: string;
  jobTitle: string;
  permissionRole: 'Shift Lead' | 'Operator' | 'Administrator';
  zone: string;
  summary: string;
}

export interface Operator {
  id: string;
  badgeCode: string;
  name: string;
  jobTitle: string;
  permissionRole: 'Shift Lead' | 'Operator' | 'Administrator';
  zone: string;
  squad: string;
  certifications: string[];
  readinessIndex: number; // non-medical demo metric
  avatarInitials: string;
  stationCoords: { x: number; y: number };
}

export interface ShiftAssignment {
  operatorId: string;
  date: string; // YYYY-MM-DD
  shiftCode: ShiftCode;
  zone: string;
  locked: boolean;
  isDraftChanged?: boolean;
  note?: string;
  positionId?: string;
  requiredCert?: string;
  availability?: 'present' | 'break' | 'unavailable';
}

export interface ScheduleScope {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  days: string[];
  dayLabels: string[];
  version: string;
  status: 'Draft' | 'Validated' | 'Published' | 'Changes Pending';
  publishedAtIso: string;
  publishedBy: string;
  assignments: ShiftAssignment[];
  publishedAssignments: ShiftAssignment[];
  facility?: string;
  team?: string;
  validatedFingerprint?: string;
  advisoryAcknowledged?: boolean;
  snapshots?: PublishedSnapshot[];
}

export interface PublishedSnapshot {
  version: string;
  publishedAtIso: string;
  publishedBy: string;
  assignments: ShiftAssignment[];
}

export interface CoverageRequirement {
  id: string;
  date: string;
  shiftCode: ShiftCode;
  zone: string;
  role: string;
  requiredCert?: string;
  hardMinimum: number;
  preferredTarget: number;
  startIso?: string;
  endIso?: string;
}

export interface ValidationIssue {
  id: string;
  severity: 'blocking' | 'advisory';
  category: 'turnaround_rest' | 'understaffing' | 'overtime' | 'certification' | 'overlap' | 'availability' | 'trade';
  title: string;
  description: string;
  remediation: string;
  operatorId?: string;
  date?: string;
  zone?: string;
  startIso?: string;
  endIso?: string;
}

export interface ValidationResult {
  scopeId: string;
  validatedAtIso: string;
  blockingCount: number;
  advisoryCount: number;
  issues: ValidationIssue[];
  canPublish: boolean;
  inputFingerprint?: string;
  coverage?: { requirementId: string; staffed: number; uncoveredMinutes: number }[];
}

export interface ReplacementCandidate {
  operatorId: string;
  restHoursBefore: number;
  projectedWeeklyHours: number;
  certMatch: boolean;
  availabilityStatus: string;
  overtimeImpactHours: number;
  fairnessDelta: string;
  ineligibleReason: string | null;
}

export interface CoverageGap {
  id: string;
  date: string;
  shiftCode: ShiftCode;
  zone: string;
  roleRequired: string;
  requiredCert: string;
  preferredTarget: number;
  hardMinimum: number;
  currentStaffed: number;
  severity: 'blocking' | 'advisory';
  reason: string;
  candidates: ReplacementCandidate[];
  assignedReplacementId?: string;
  sourceLeaveRequestId?: string;
}

export interface AIProposedChange {
  operatorId: string;
  operatorName: string;
  date: string;
  fromShift: ShiftCode;
  toShift: ShiftCode;
  zone: string;
  rationale: string;
}

export interface AIProposal {
  id: string;
  scopeId: string;
  generatedAtIso: string;
  title: string;
  summary: string;
  fairnessScorePct: number;
  turnaroundViolations: number;
  HardGapsRemaining: number;
  proposedChanges: AIProposedChange[];
  inputFingerprint?: string;
  validation?: ValidationResult;
}

export interface LeaveRequest {
  id: string;
  operatorId: string;
  leaveType: 'Annual Leave' | 'Medical / Personal' | 'Compensatory Off Request';
  startDate: string;
  endDate: string;
  reason: string;
  status:
    | 'Pending Approval'
    | 'Approved — schedule update pending'
    | 'Approved & Published'
    | 'Declined';
  requestedChanges?: string;
  submittedAtIso: string;
  affectedShift: ShiftCode;
  coverageImpactSummary: string;
  reviewerNote?: string;
  replacementOperatorId?: string;
}

export interface ShiftTrade {
  id: string;
  requesterId: string;
  requesterDate: string;
  requesterShift: ShiftCode;
  partnerId: string;
  partnerDate: string;
  partnerShift: ShiftCode;
  status:
    | 'Awaiting Partner'
    | 'Partner Accepted'
    | 'Supervisor Review'
    | 'Approved & Applied'
    | 'Approved — schedule update pending'
    | 'Changes Requested'
    | 'Declined'
    | 'Expired';
  reason: string;
  submittedAtIso: string;
  validationPassed: boolean;
  validationNotes: string[];
}

export interface IncidentChecklistStep {
  id: string;
  label: string;
  completed: boolean;
  completedAtIso?: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  severity: 'L1 · Minor' | 'L2 · Elevated' | 'L3 · Critical';
  status: 'Open' | 'Mitigating' | 'Resolved';
  zone: string;
  ownerOperatorId: string;
  openedAtIso: string;
  summary: string;
  outcomeNote: string;
  carryToHandover: boolean;
  checklist: IncidentChecklistStep[];
}

export interface HandoverSession {
  id: string;
  date: string;
  outgoingShift: ShiftCode;
  incomingShift: ShiftCode;
  overlapWindowLabel: string;
  outgoingLeadName: string;
  incomingLeadName: string;
  systemUptimePct: number;
  openTicketsCount: number;
  keyFobTransferred: boolean;
  summaryNote: string;
  status: 'In Progress (Overlap Active)' | 'Ready for Sign-Off' | 'Signed Off & Sealed';
  outgoingSignedAtIso?: string;
  incomingAcknowledgedAtIso?: string;
}

export interface SchedulingRulesConfig {
  minRestHours: number;
  weeklyHoursAdvisoryLimit: number;
  hardMinimumFloorCoverage: number;
  preferredFloorTarget: number;
  requireCertMatch: boolean;
  allowOvernightBackToBack: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestampIso: string;
  actorName: string;
  actorRole: string;
  action: string;
  scope: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface BroadcastNotice {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'urgent';
  targetZone: string;
  sentBy: string;
  sentAtIso: string;
}

export interface FleetUnit {
  id: string;
  name: string;
  zone: string;
  status: 'Nominal' | 'Charging' | 'Calibration';
  batteryPct: number;
  assignedOperatorId: string;
}

export interface MissionRecord {
  id: string;
  title: string;
  zone: string;
  leadOperatorId: string;
  status: 'In Progress' | 'Scheduled' | 'Completed';
  etaLabel: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestampIso: string;
  read: boolean;
  category: 'approval' | 'coverage' | 'incident' | 'publication';
  linkWorkspace?: WorkspaceId;
}

export interface SavedViewPreset {
  id: string;
  name: string;
  workspace: WorkspaceId;
  subView?: ScheduleSubView;
  filters: {
    zone?: string;
    shiftCode?: ShiftCode | 'ALL';
    searchQuery?: string;
  };
}

export interface ConcurrentEditConflict {
  scopeId: string;
  localBaseVersion: string;
  remoteVersion: string;
  remoteActor: string;
  remoteTimestampIso: string;
  conflictingCells: {
    operatorId: string;
    operatorName: string;
    date: string;
    yourShift: ShiftCode;
    theirShift: ShiftCode;
  }[];
}

export interface SupportingPanelState {
  kind:
    | null
    | 'operator_dossier'
    | 'assignment_edit'
    | 'coverage_gap'
    | 'leave_request'
    | 'shift_trade'
    | 'incident_detail'
    | 'ai_proposal_review'
    | 'publication_review'
    | 'conflict_resolution';
  entityId?: string;
  secondaryId?: string;
  widthPx: number;
}
