import type { CoverageGap, IncidentRecord, LeaveRequest, Operator, ShiftTrade, SupportingPanelState, ValidationIssue } from '../data/shiftSyncTypes';

export type AttentionCategory = 'all' | 'coverage' | 'approvals' | 'guardrails' | 'incidents';
export type AttentionStatus = 'open' | 'completed';
export interface AttentionItem {
  id: string;
  category: Exclude<AttentionCategory, 'all'>;
  title: string;
  description: string;
  context: string;
  status: AttentionStatus;
  priority: 'critical' | 'review' | 'staged' | 'complete';
  action: string;
  panel: SupportingPanelState | null;
}
export interface AttentionSource {
  coverageGaps: CoverageGap[];
  leaveRequests: LeaveRequest[];
  shiftTrades: ShiftTrade[];
  incidents: IncidentRecord[];
  issues: ValidationIssue[];
  operators: Operator[];
}
