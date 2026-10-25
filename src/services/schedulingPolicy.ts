import type { CoverageRequirement, LeaveRequest, Operator, PersonaProfile, ScheduleScope, SchedulingRulesConfig, ShiftAssignment, ShiftCode, ShiftTrade, ValidationIssue, ValidationResult } from '../data/shiftSyncTypes';
import { getShiftEpochBounds, SHIFT_CATALOG } from '../utils/shiftSyncEngine';
import type { CoverageGap, ReplacementCandidate } from '../data/shiftSyncTypes';

export interface PolicyInputs {
  nowIso: string;
  boundaryAssignments: ShiftAssignment[];
  requirements: CoverageRequirement[];
  leaveRequests: LeaveRequest[];
  operators: Operator[];
  rules: SchedulingRulesConfig;
}
export type Transition<T> = { ok: true; value: T } | { ok: false; error: string };
export interface AssignmentEdit { operatorId: string; date: string; shiftCode: ShiftCode; zone?: string; note?: string }

/** Deterministic replacement alternatives calculated from the current draft and adjacent periods. */
export function replacementCandidates(scope: ScheduleScope, gap: CoverageGap, inputs: PolicyInputs, actor: PersonaProfile): ReplacementCandidate[] {
  const target = getShiftEpochBounds(gap.date, gap.shiftCode);
  return inputs.operators.map((operator): ReplacementCandidate => {
    const prior = [...inputs.boundaryAssignments, ...scope.assignments].filter((assignment) => assignment.operatorId === operator.id)
      .map((assignment) => getShiftEpochBounds(assignment.date, assignment.shiftCode)).filter((bounds) => bounds && target && bounds.endMs <= target.startMs);
    const previousEnd = Math.max(...prior.map((bounds) => bounds?.endMs ?? 0));
    const rest = target && Number.isFinite(previousEnd) ? (target.startMs - previousEnd) / 3600000 : 168;
    const certMatch = operator.certifications.includes(gap.requiredCert);
    const result = editSchedule(scope, [{ operatorId: operator.id, date: gap.date, shiftCode: gap.shiftCode, zone: gap.zone }], actor, inputs.nowIso);
    const hours = (result.ok ? result.value : scope).assignments.filter((assignment) => assignment.operatorId === operator.id).reduce((sum, assignment) => sum + SHIFT_CATALOG[assignment.shiftCode].scheduledHours, 0);
    const problem = result.ok ? validateDomainScope(result.value, { ...inputs, operators: [operator], requirements: [] }).issues.find((issue) => issue.severity === 'blocking' && issue.operatorId === operator.id) : null;
    const existing = scope.assignments.find((assignment) => assignment.operatorId === operator.id && assignment.date === gap.date);
    const reason = !certMatch ? `Missing ${gap.requiredCert}` : existing && !['WO', 'CO'].includes(existing.shiftCode) ? 'Already assigned; choose an available relief operator.' : !result.ok ? result.error : problem?.title ?? null;
    return { operatorId: operator.id, restHoursBefore: Math.round(rest * 10) / 10, projectedWeeklyHours: hours, certMatch, availabilityStatus: reason ? 'Unavailable' : 'Available for this interval', overtimeImpactHours: Math.max(0, hours - inputs.rules.weeklyHoursAdvisoryLimit), fairnessDelta: 'Illustrative equity only', ineligibleReason: reason };
  }).sort((left, right) => Number(Boolean(left.ineligibleReason)) - Number(Boolean(right.ineligibleReason)) || left.projectedWeeklyHours - right.projectedWeeklyHours);
}

/** Stable cache identity, not a cryptographic signature or authentication token. */
export function scheduleFingerprint(scope: ScheduleScope, inputs: PolicyInputs): string {
  const text = JSON.stringify([scope.id, scope.assignments, inputs]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}

/** Start-inclusive, end-exclusive staffed positions; duplicate people/positions cannot inflate totals. */
export function staffingAt(assignments: ShiftAssignment[], operators: Operator[], atMs: number, zone?: string, cert?: string, operational = false): number {
  const eligible = new Map(operators.map((operator) => [operator.id, operator]));
  const people = new Set<string>();
  const positions = new Set<string>();
  for (const assignment of assignments) {
    const bounds = getShiftEpochBounds(assignment.date, assignment.shiftCode);
    const operator = eligible.get(assignment.operatorId);
    if (!bounds || !operator || atMs < bounds.startMs || atMs >= bounds.endMs) continue;
    if (zone && zone !== 'ALL' && assignment.zone !== zone) continue;
    if (cert && !operator.certifications.includes(cert)) continue;
    if (assignment.requiredCert && !operator.certifications.includes(assignment.requiredCert)) continue;
    if (operational && assignment.availability && assignment.availability !== 'present') continue;
    const position = assignment.positionId ?? `${assignment.operatorId}:${assignment.date}`;
    if (people.has(operator.id) || positions.has(position)) continue;
    people.add(operator.id); positions.add(position);
  }
  return positions.size;
}

/** Validates the whole publication period and adjacent rest dependencies. */
export function validateDomainScope(scope: ScheduleScope, inputs: PolicyInputs): ValidationResult {
  const issues: ValidationIssue[] = [];
  const now = Date.parse(inputs.nowIso);
  const days = new Set(scope.days);
  const combined = [...inputs.boundaryAssignments.filter((assignment) => !days.has(assignment.date)), ...scope.assignments];
  const approved = inputs.leaveRequests.filter((request) => request.status === 'Approved — schedule update pending' || request.status === 'Approved & Published');
  for (const operator of inputs.operators) {
    const working = combined.filter((assignment) => assignment.operatorId === operator.id && getShiftEpochBounds(assignment.date, assignment.shiftCode))
      .sort((left, right) => Date.parse(`${left.date}T00:00Z`) - Date.parse(`${right.date}T00:00Z`));
    for (let index = 0; index < working.length; index += 1) {
      const assignment = working[index];
      const bounds = getShiftEpochBounds(assignment.date, assignment.shiftCode);
      if (!bounds) continue;
      if (days.has(assignment.date) && bounds.endMs > now) {
        const common = { operatorId: operator.id, date: assignment.date, zone: assignment.zone, startIso: new Date(bounds.startMs).toISOString(), endIso: new Date(bounds.endMs).toISOString() };
        if (approved.some((request) => request.operatorId === operator.id && assignment.date >= request.startDate && assignment.date <= request.endDate))
          issues.push({ ...common, id: `leave-${operator.id}-${assignment.date}`, severity: 'blocking', category: 'availability', title: `${operator.name} is on approved leave`, description: 'A working assignment conflicts with an approved absence.', remediation: 'Assign WO and plan qualified replacement coverage.' });
        if (assignment.availability === 'unavailable' || (inputs.rules.requireCertMatch && assignment.requiredCert && !operator.certifications.includes(assignment.requiredCert)))
          issues.push({ ...common, id: `cert-${operator.id}-${assignment.date}`, severity: 'blocking', category: 'certification', title: `${operator.name}: unavailable or missing required certification`, description: `Position requires ${assignment.requiredCert ?? 'recorded availability'}.`, remediation: 'Choose an available, qualified operator.' });
      }
      const previous = working[index - 1];
      const previousBounds = previous && getShiftEpochBounds(previous.date, previous.shiftCode);
      if (!previousBounds || (!days.has(assignment.date) && !days.has(previous.date)) || bounds.endMs <= now) continue;
      const rest = (bounds.startMs - previousBounds.endMs) / 3600000;
      if (rest < inputs.rules.minRestHours) issues.push({ id: `rest-${operator.id}-${assignment.date}-${index}`, severity: 'blocking', category: rest < 0 ? 'overlap' : 'turnaround_rest', title: `${operator.name}: ${rest.toFixed(1)}h rest`, description: `${previous.date} ${previous.shiftCode} → ${assignment.date} ${assignment.shiftCode}; minimum ${inputs.rules.minRestHours}h.`, remediation: 'Move the future assignment later or assign a qualified replacement.', operatorId: operator.id, date: assignment.date, zone: assignment.zone });
    }
    const total = scope.assignments.filter((assignment) => assignment.operatorId === operator.id).reduce((sum, assignment) => sum + SHIFT_CATALOG[assignment.shiftCode].scheduledHours, 0);
    if (total > inputs.rules.weeklyHoursAdvisoryLimit) issues.push({ id: `hours-${operator.id}`, category: 'overtime', severity: 'advisory', title: `${operator.name}: ${total} scheduled hours`, description: `Exceeds the ${inputs.rules.weeklyHoursAdvisoryLimit}h demonstration advisory threshold.`, remediation: 'Review workload or acknowledge the advisory.', operatorId: operator.id, date: scope.endDate });
  }
  for (const requirement of inputs.requirements.filter((item) => days.has(item.date))) {
    const bounds = getShiftEpochBounds(requirement.date, requirement.shiftCode);
    if (!bounds) continue;
    const start = requirement.startIso ? Date.parse(requirement.startIso) : bounds.startMs;
    const end = requirement.endIso ? Date.parse(requirement.endIso) : bounds.endMs;
    if (end <= now) continue;
    let lowest = Number.POSITIVE_INFINITY;
    for (let at = Math.max(start, now); at < end; at += 30 * 60000) lowest = Math.min(lowest, staffingAt(combined, inputs.operators, at, requirement.zone, requirement.requiredCert));
    if (lowest >= requirement.preferredTarget) continue;
    issues.push({ id: `coverage-${requirement.id}`, category: 'understaffing', severity: lowest < requirement.hardMinimum ? 'blocking' : 'advisory', title: `${requirement.zone} · ${requirement.shiftCode}: ${lowest}/${requirement.preferredTarget} positions`, description: `${requirement.date} ${requirement.role}; hard minimum ${requirement.hardMinimum}, preferred ${requirement.preferredTarget}. Eligible staffing checked every 30 minutes.`, remediation: 'Find qualified cover for this interval.', date: requirement.date, zone: requirement.zone, startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() });
  }
  const blockingCount = issues.filter((issue) => issue.severity === 'blocking').length;
  return { scopeId: scope.id, validatedAtIso: inputs.nowIso, issues, blockingCount, advisoryCount: issues.length - blockingCount, canPublish: blockingCount === 0, inputFingerprint: scheduleFingerprint(scope, inputs) };
}

/** Normal planning cannot rewrite a started assignment, including a working shift changed to off. */
export function canEditAssignment(previous: ShiftAssignment | undefined, next: AssignmentEdit, nowIso: string): boolean {
  if (previous?.locked) return false;
  const before = previous && getShiftEpochBounds(previous.date, previous.shiftCode);
  const after = getShiftEpochBounds(next.date, next.shiftCode);
  const now = Date.parse(nowIso);
  if (before && before.startMs <= now) return false;
  return after ? after.startMs > now : Date.parse(`${next.date}T23:59:59+05:30`) > now;
}

/** Applies a checked set of edits together; no partial bulk operation is possible. */
export function editSchedule(scope: ScheduleScope, edits: AssignmentEdit[], actor: PersonaProfile, nowIso: string): Transition<ScheduleScope> {
  if (actor.permissionRole === 'Operator') return { ok: false, error: 'Only a Shift Lead or Administrator can edit team assignments.' };
  if (!edits.length || edits.some((edit) => !scope.days.includes(edit.date))) return { ok: false, error: 'Choose assignments in this schedule period.' };
  const next = scope.assignments.map((assignment) => ({ ...assignment }));
  for (const edit of edits) {
    const index = next.findIndex((assignment) => assignment.operatorId === edit.operatorId && assignment.date === edit.date);
    const previous = next[index];
    if (previous?.shiftCode === edit.shiftCode && (!edit.zone || edit.zone === previous.zone)) continue;
    if (!canEditAssignment(previous, edit, nowIso)) return { ok: false, error: 'Past, locked, and in-progress assignments are read-only. Choose an unstarted assignment.' };
    const assignment: ShiftAssignment = { ...previous, ...edit, zone: edit.zone ?? previous?.zone ?? actor.zone, locked: false, isDraftChanged: true };
    if (index < 0) next.push(assignment); else next[index] = assignment;
  }
  return { ok: true, value: { ...scope, assignments: next, status: scope.publishedAssignments.length ? 'Changes Pending' : 'Draft', validatedFingerprint: undefined, advisoryAcknowledged: false } };
}

/** Stages the agreed bilateral terms without changing either published assignment. */
export function stageTrade(scope: ScheduleScope, trade: ShiftTrade, actor: PersonaProfile, inputs: PolicyInputs): Transition<ScheduleScope> {
  if (trade.status !== 'Supervisor Review') return { ok: false, error: 'Counterpart acceptance and supervisor review are required.' };
  const left = scope.assignments.find((assignment) => assignment.operatorId === trade.requesterId && assignment.date === trade.requesterDate);
  const right = scope.assignments.find((assignment) => assignment.operatorId === trade.partnerId && assignment.date === trade.partnerDate);
  if (!left || !right || left.shiftCode !== trade.requesterShift || right.shiftCode !== trade.partnerShift) return { ok: false, error: 'Trade terms changed. Request renewed counterpart acceptance.' };
  const result = editSchedule(scope, [{ operatorId: left.operatorId, date: left.date, shiftCode: trade.partnerShift, zone: right.zone, note: trade.id }, { operatorId: right.operatorId, date: right.date, shiftCode: trade.requesterShift, zone: left.zone, note: trade.id }], actor, inputs.nowIso);
  if (!result.ok) return result;
  const validation = validateDomainScope(result.value, inputs);
  if (!validation.canPublish) return { ok: false, error: validation.issues.find((issue) => issue.severity === 'blocking')?.title ?? 'Trade violates scheduling rules.' };
  return result;
}

/** Publishes a fresh, acknowledged draft atomically and preserves the previous immutable snapshot. */
export function publishSchedule(scope: ScheduleScope, actor: PersonaProfile, inputs: PolicyInputs, trades: ShiftTrade[]): Transition<ScheduleScope> {
  if (actor.permissionRole === 'Operator') return { ok: false, error: 'Your role cannot publish schedules.' };
  const validation = validateDomainScope(scope, inputs);
  if (scope.validatedFingerprint !== validation.inputFingerprint) return { ok: false, error: 'Validation Required: validate the latest assignments, availability, and rules.' };
  if (!validation.canPublish) return { ok: false, error: 'Resolve every blocking error before publishing. Hard constraints cannot be overridden.' };
  if (validation.advisoryCount && !scope.advisoryAcknowledged) return { ok: false, error: 'Review and acknowledge advisory warnings before publishing.' };
  for (const trade of trades.filter((item) => item.status === 'Approved — schedule update pending' && scope.days.includes(item.requesterDate))) {
    const left = scope.assignments.find((assignment) => assignment.operatorId === trade.requesterId && assignment.date === trade.requesterDate);
    const right = scope.assignments.find((assignment) => assignment.operatorId === trade.partnerId && assignment.date === trade.partnerDate);
    if (left?.shiftCode !== trade.partnerShift || right?.shiftCode !== trade.requesterShift || left.note !== trade.id || right.note !== trade.id) return { ok: false, error: `Trade ${trade.id} changed after approval. Both terms require renewed acceptance.` };
  }
  const previous = { version: scope.version, publishedAtIso: scope.publishedAtIso, publishedBy: scope.publishedBy, assignments: structuredClone(scope.publishedAssignments) };
  const [major, minor = 0] = scope.version.replace('v', '').replace('-draft', '').split('.').map(Number);
  const assignments = scope.assignments.map((assignment) => ({ ...assignment, isDraftChanged: false }));
  return { ok: true, value: { ...scope, version: `v${major}.${minor + 1}`, status: 'Published', publishedAtIso: inputs.nowIso, publishedBy: actor.name, assignments, publishedAssignments: structuredClone(assignments), snapshots: [...(scope.snapshots ?? []), previous], validatedFingerprint: undefined, advisoryAcknowledged: false } };
}
