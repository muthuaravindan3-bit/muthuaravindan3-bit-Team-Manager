import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialModel, modelSchema, readLocalModel } from '../store/localModel';
import { BOUNDARY_ASSIGNMENTS, PERSONAS } from '../data/shiftSyncSeed';
import { editSchedule, publishSchedule, replacementCandidates, scheduleFingerprint, stageTrade, staffingAt, validateDomainScope, type PolicyInputs } from '../services/schedulingPolicy';
import { activeAssignments, isDaySwingOverlap, nextAssignment, publishedAssignments } from '../services/operationalSelectors';
import { computeRestHoursBetween, computeShiftProgress, getShiftEpochBounds, SHIFT_CATALOG } from '../utils/shiftSyncEngine';
import type { ScheduleScope } from '../data/shiftSyncTypes';

function fixture() {
  const model = createInitialModel();
  const inputs = (scopeId: string): PolicyInputs => ({ nowIso: '2026-10-25T14:00:00+05:30', operators: model.operators, rules: model.rulesConfig, leaveRequests: model.leaveRequests, requirements: model.coverageRequirements, boundaryAssignments: [...BOUNDARY_ASSIGNMENTS, ...Object.values(model.scopes).filter((scope) => scope.id !== scopeId).flatMap((scope) => scope.assignments)] });
  return { model, inputs, current: model.scopes['scope-2026-10-19'], future: model.scopes['scope-2026-10-26'], lead: PERSONAS[0], operator: PERSONAS[1] };
}
function checked(scope: ScheduleScope, inputs: PolicyInputs): ScheduleScope {
  const validation = validateDomainScope(scope, inputs);
  return { ...scope, validatedFingerprint: validation.inputFingerprint, advisoryAcknowledged: true };
}

describe('shared scheduling and publication policy', () => {
  it('uses exact scheduled durations without assuming unpaid breaks', () => {
    for (const [code, duration] of [['1ST', 9], ['2ND', 8], ['3RD', 11], ['GEN', 9], ['WO', 0], ['CO', 0]] as const) {
      assert.equal(SHIFT_CATALOG[code].scheduledHours, duration);
      assert.equal(SHIFT_CATALOG[code].paidHours, duration);
      assert.equal(SHIFT_CATALOG[code].unpaidBreakHours, 0);
    }
  });
  it('carries Night through midnight with end-exclusive boundaries', () => {
    const { model } = fixture();
    const assignment = { operatorId: 'op-rohan', date: '2026-10-25', shiftCode: '3RD' as const, zone: 'Sector B · Substation', locked: false };
    assert.equal((getShiftEpochBounds(assignment.date, assignment.shiftCode)!.endMs - getShiftEpochBounds(assignment.date, assignment.shiftCode)!.startMs) / 3600000, 11);
    assert.equal(staffingAt([assignment], model.operators, Date.parse('2026-10-26T07:29:00+05:30')), 1);
    assert.equal(staffingAt([assignment], model.operators, Date.parse('2026-10-26T07:30:00+05:30')), 0);
    assert.equal(staffingAt([assignment, assignment], model.operators, Date.parse('2026-10-26T03:00:00+05:30')), 1);
  });
  it('starts with feasible scoped schedules and supported 18-position baseline', () => {
    const { model, current, future, inputs } = fixture();
    assert.equal(staffingAt(publishedAssignments(model.scopes), model.operators, Date.parse(inputs(current.id).nowIso), undefined, undefined, true), 18);
    assert.equal(validateDomainScope(current, inputs(current.id)).blockingCount, 0);
    assert.equal(validateDomainScope(future, inputs(future.id)).blockingCount, 0);
  });
  it('blocks a future Night interval with two eligible people against minimum three', () => {
    const { future, inputs, lead } = fixture();
    const nights = future.assignments.filter((assignment) => assignment.date === '2026-10-26' && assignment.shiftCode === '3RD');
    const result = editSchedule(future, [{ ...nights[0], shiftCode: 'WO' }], lead, inputs(future.id).nowIso);
    assert.ok(result.ok);
    const validation = validateDomainScope(result.value, inputs(future.id));
    assert.ok(validation.issues.some((issue) => issue.category === 'understaffing' && issue.severity === 'blocking' && issue.date === '2026-10-26'));
    assert.equal(publishSchedule(checked(result.value, inputs(future.id)), lead, inputs(future.id), []).ok, false);
  });
  it('validates rest across the reporting/planning boundary', () => {
    const { future, inputs } = fixture();
    assert.equal(computeRestHoursBetween('2026-10-25', '3RD', '2026-10-26', '1ST'), 0);
    const changed = { ...future, assignments: future.assignments.map((assignment) => assignment.operatorId === 'op-rohan' && assignment.date === '2026-10-26' ? { ...assignment, shiftCode: '1ST' as const } : assignment) };
    assert.ok(validateDomainScope(changed, inputs(future.id)).issues.some((issue) => issue.category === 'turnaround_rest' && issue.operatorId === 'op-rohan'));
  });
  it('requires fresh validation and advisory acknowledgement, with no override', () => {
    const { future, inputs, lead } = fixture();
    assert.equal(publishSchedule(future, lead, inputs(future.id), []).ok, false);
    const ready = checked(future, inputs(future.id));
    assert.equal(publishSchedule({ ...ready, advisoryAcknowledged: false }, lead, inputs(future.id), []).ok, false);
    assert.equal(publishSchedule(ready, lead, { ...inputs(future.id), rules: { ...inputs(future.id).rules, minRestHours: 12 } }, []).ok, false);
    assert.equal(publishSchedule(ready, lead, inputs(future.id), []).ok, true);
  });
  it('keeps proposal previews isolated and marks changed published scopes Changes Pending', () => {
    const { future, lead, inputs } = fixture();
    const before = structuredClone(future);
    const preview = editSchedule(future, [{ operatorId: 'op-sofia', date: '2026-10-27', shiftCode: '1ST' }], lead, inputs(future.id).nowIso);
    assert.ok(preview.ok);
    assert.equal(preview.value.status, 'Changes Pending');
    assert.deepEqual(future, before);
    assert.deepEqual(preview.value.publishedAssignments, before.publishedAssignments);
    assert.notEqual(scheduleFingerprint(preview.value, inputs(future.id)), scheduleFingerprint(future, inputs(future.id)));
  });
  it('stages a valid trade and publishes both sides together while preserving current week', () => {
    const { model, current, future, inputs, lead } = fixture();
    const currentSnapshot = structuredClone(current.publishedAssignments);
    const trade = model.shiftTrades[0];
    const staged = stageTrade(future, trade, lead, inputs(future.id));
    assert.ok(staged.ok, !staged.ok ? staged.error : '');
    assert.deepEqual(staged.value.publishedAssignments, future.publishedAssignments);
    const pending = { ...trade, status: 'Approved — schedule update pending' as const };
    const result = publishSchedule(checked(staged.value, inputs(future.id)), lead, inputs(future.id), [pending]);
    assert.ok(result.ok);
    assert.equal(result.value.publishedAssignments.find((assignment) => assignment.operatorId === trade.requesterId && assignment.date === trade.requesterDate)?.shiftCode, trade.partnerShift);
    assert.equal(result.value.publishedAssignments.find((assignment) => assignment.operatorId === trade.partnerId && assignment.date === trade.partnerDate)?.shiftCode, trade.requesterShift);
    assert.deepEqual(current.publishedAssignments, currentSnapshot);
    assert.deepEqual(result.value.snapshots?.at(-1)?.assignments, future.publishedAssignments);
  });
  it('rejects stale or partially edited trade terms and leaves original records unchanged', () => {
    const { model, future, inputs, lead } = fixture();
    const trade = model.shiftTrades[0];
    assert.equal(stageTrade(future, { ...trade, requesterShift: '3RD' }, lead, inputs(future.id)).ok, false);
    const staged = stageTrade(future, trade, lead, inputs(future.id)); assert.ok(staged.ok);
    const broken = { ...staged.value, assignments: staged.value.assignments.map((assignment) => assignment.operatorId === trade.partnerId && assignment.date === trade.partnerDate ? { ...assignment, note: 'changed terms' } : assignment) };
    assert.equal(publishSchedule(checked(broken, inputs(future.id)), lead, inputs(future.id), [{ ...trade, status: 'Approved — schedule update pending' }]).ok, false);
  });
  it('rejects role bypasses and past/in-progress edits at the mutation boundary', () => {
    const { current, future, operator, lead, inputs } = fixture();
    assert.equal(editSchedule(future, [{ operatorId: 'op-priya', date: '2026-10-27', shiftCode: 'WO' }], operator, inputs(future.id).nowIso).ok, false);
    assert.equal(editSchedule(current, [{ operatorId: 'op-priya', date: '2026-10-25', shiftCode: 'WO' }], lead, inputs(current.id).nowIso).ok, false);
    assert.equal(publishSchedule(checked(future, inputs(future.id)), operator, inputs(future.id), []).ok, false);
  });
  it('blocks approved leave and missing position certification', () => {
    const { model, future, inputs } = fixture();
    const policy = { ...inputs(future.id), leaveRequests: [{ ...model.leaveRequests[0], status: 'Approved — schedule update pending' as const }] };
    assert.ok(validateDomainScope(future, policy).issues.some((issue) => issue.category === 'availability'));
    const unqualified = { ...future, assignments: future.assignments.map((assignment) => assignment.operatorId === 'op-priya' && assignment.date === '2026-10-27' ? { ...assignment, requiredCert: 'Missing-Cert' } : assignment) };
    assert.ok(validateDomainScope(unqualified, inputs(future.id)).issues.some((issue) => issue.category === 'certification'));
  });
  it('calculates 10h15m to next Day at 21:15 and ends overlap', () => {
    const { model } = fixture(); const now = '2026-10-25T21:15:00+05:30';
    const next = nextAssignment(publishedAssignments(model.scopes), 'op-alex', now); assert.ok(next);
    assert.equal(computeShiftProgress(next.date, next.shiftCode, now).countdownLabel, 'Starts in 10h 15m');
    assert.equal(isDaySwingOverlap(now), false);
    assert.ok(activeAssignments(publishedAssignments(model.scopes), now).every((assignment) => assignment.shiftCode === '3RD'));
  });
  it('derives eligible replacement rest/hours from records', () => {
    const { model, current, inputs, lead } = fixture();
    const candidates = replacementCandidates(current, model.coverageGaps[0], inputs(current.id), lead);
    const sofia = candidates.find((candidate) => candidate.operatorId === 'op-sofia');
    assert.equal(sofia?.restHoursBefore, 76); assert.equal(sofia?.projectedWeeklyHours, 47); assert.equal(sofia?.ineligibleReason, null);
    assert.ok(candidates.find((candidate) => candidate.operatorId === 'op-marcus')?.ineligibleReason);
  });
  it('round trips validated local state and preserves invalid saved data for recovery', () => {
    const { model } = fixture(); assert.ok(modelSchema.safeParse(model).success);
    assert.deepEqual(readLocalModel({ getItem: () => JSON.stringify(model) }).model, JSON.parse(JSON.stringify(model)));
    assert.ok(readLocalModel({ getItem: () => '{"bad":"payload"}' }).warning);
  });
});
