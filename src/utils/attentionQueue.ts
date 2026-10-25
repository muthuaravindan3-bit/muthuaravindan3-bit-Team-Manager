import type { AttentionCategory, AttentionItem, AttentionSource, AttentionStatus } from '../types/attention';

/** Derives the inbox from domain records so counts and completion always agree. */
export function buildAttentionQueue(source: AttentionSource): AttentionItem[] {
  const names = new Map(source.operators.map((operator) => [operator.id, operator.name]));
  const items: AttentionItem[] = [];
  for (const gap of source.coverageGaps) {
    items.push({ id: gap.id, category: 'coverage', title: `${gap.zone} needs ${gap.roleRequired}`,
      description: gap.reason, context: `${gap.date} · ${gap.shiftCode} · ${gap.currentStaffed}/${gap.preferredTarget} staffed`,
      status: 'open', priority: gap.assignedReplacementId ? 'staged' : gap.severity === 'blocking' ? 'critical' : 'review',
      action: gap.assignedReplacementId ? 'Review replacement' : 'Compare candidates',
      panel: { kind: 'coverage_gap', entityId: gap.id, widthPx: 480 } });
  }
  for (const request of source.leaveRequests) {
    const isComplete = request.status === 'Approved & Published' || request.status === 'Declined';
    items.push({ id: request.id, category: 'approvals', title: `${names.get(request.operatorId) ?? request.operatorId} · ${request.leaveType}`,
      description: request.coverageImpactSummary, context: `${request.startDate} · ${request.affectedShift} · ${request.status}`,
      status: isComplete ? 'completed' : 'open', priority: isComplete ? 'complete' : request.status === 'Pending Approval' ? 'review' : 'staged',
      action: isComplete ? 'View decision' : request.status === 'Pending Approval' ? 'Review request' : 'Review coverage',
      panel: { kind: 'leave_request', entityId: request.id, widthPx: 480 } });
  }
  for (const trade of source.shiftTrades) {
    const isComplete = ['Approved & Applied', 'Declined', 'Expired'].includes(trade.status);
    items.push({ id: trade.id, category: 'approvals', title: `${names.get(trade.requesterId) ?? trade.requesterId} ↔ ${names.get(trade.partnerId) ?? trade.partnerId}`,
      description: trade.reason, context: `${trade.requesterDate} · ${trade.requesterShift} ↔ ${trade.partnerShift} · ${trade.status}`,
      status: isComplete ? 'completed' : 'open', priority: isComplete ? 'complete' : 'review', action: isComplete ? 'View decision' : 'Review trade',
      panel: { kind: 'shift_trade', entityId: trade.id, widthPx: 480 } });
  }
  for (const issue of source.issues) {
    items.push({ id: issue.id, category: 'guardrails', title: issue.title, description: issue.description,
      context: issue.remediation, status: 'open', priority: issue.severity === 'blocking' ? 'critical' : 'review', action: 'Review assignment',
      panel: issue.operatorId && issue.date ? { kind: 'assignment_edit', entityId: issue.operatorId, secondaryId: issue.date, widthPx: 480 } : null });
  }
  for (const incident of source.incidents) {
    const isComplete = incident.status === 'Resolved';
    items.push({ id: incident.id, category: 'incidents', title: incident.title, description: incident.summary,
      context: `${incident.zone} · ${incident.checklist.filter((step) => step.completed).length}/${incident.checklist.length} steps · ${incident.status}`,
      status: isComplete ? 'completed' : 'open', priority: isComplete ? 'complete' : incident.severity === 'L3 · Critical' ? 'critical' : 'review',
      action: isComplete ? 'View outcome' : 'Open runbook', panel: { kind: 'incident_detail', entityId: incident.id, widthPx: 480 } });
  }
  const rank = { critical: 0, review: 1, staged: 2, complete: 3 };
  return items.sort((left, right) => rank[left.priority] - rank[right.priority] || left.id.localeCompare(right.id));
}

/** Matches plain text without evaluating user input as markup or a pattern. */
export function filterAttentionQueue(items: AttentionItem[], category: AttentionCategory, status: AttentionStatus, query: string): AttentionItem[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => item.status === status && (category === 'all' || item.category === category) &&
    words.every((word) => `${item.id} ${item.title} ${item.description} ${item.context}`.toLocaleLowerCase().includes(word)));
}
