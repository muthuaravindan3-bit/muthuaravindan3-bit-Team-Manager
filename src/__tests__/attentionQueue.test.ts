import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAttentionQueue, filterAttentionQueue } from '../utils/attentionQueue';
import { INITIAL_COVERAGE_GAPS, INITIAL_INCIDENTS, INITIAL_LEAVE_REQUESTS, INITIAL_OPERATORS, INITIAL_SHIFT_TRADES } from '../data/shiftSyncSeed';
import type { AttentionSource } from '../types/attention';

const source: AttentionSource = {
  coverageGaps: INITIAL_COVERAGE_GAPS, incidents: INITIAL_INCIDENTS,
  leaveRequests: INITIAL_LEAVE_REQUESTS, operators: INITIAL_OPERATORS,
  shiftTrades: INITIAL_SHIFT_TRADES, issues: []
};

describe('attention queue', () => {
  it('handles an empty operations inbox', () => {
    assert.deepEqual(buildAttentionQueue({ coverageGaps: [], incidents: [], leaveRequests: [], operators: [], shiftTrades: [], issues: [] }), []);
  });
  it('puts blocking work before routine reviews without mutating source records', () => {
    const before = JSON.stringify(source);
    const queue = buildAttentionQueue({ ...source, coverageGaps: [{ ...INITIAL_COVERAGE_GAPS[0], severity: 'blocking' }] });
    assert.equal(queue[0].priority, 'critical');
    const firstReview = queue.findIndex((item) => item.priority === 'review');
    assert.ok(firstReview > 0);
    assert.ok(queue.slice(firstReview).every((item) => item.priority !== 'critical'));
    assert.equal(JSON.stringify(source), before);
  });
  it('moves finalized leave decisions and trades out of open work', () => {
    const queue = buildAttentionQueue({ ...source,
      leaveRequests: [{ ...INITIAL_LEAVE_REQUESTS[0], status: 'Declined' }],
      shiftTrades: [{ ...INITIAL_SHIFT_TRADES[0], status: 'Approved & Applied' }]
    });
    const open = filterAttentionQueue(queue, 'approvals', 'open', '');
    assert.equal(open.length, 0);
    assert.equal(filterAttentionQueue(queue, 'approvals', 'completed', '').length, 2);
  });
  it('keeps approved leave visible until the schedule is published', () => {
    const queue = buildAttentionQueue({ ...source, leaveRequests: [{ ...INITIAL_LEAVE_REQUESTS[0], status: 'Approved — schedule update pending' }] });
    const item = queue.find((entry) => entry.id === INITIAL_LEAVE_REQUESTS[0].id);
    assert.equal(item?.status, 'open');
    assert.equal(item?.priority, 'staged');
  });
  it('removes resolved incidents from open work and preserves outcome access', () => {
    const queue = buildAttentionQueue({ ...source, incidents: [{ ...INITIAL_INCIDENTS[0], status: 'Resolved' }] });
    assert.equal(filterAttentionQueue(queue, 'incidents', 'open', '').length, 0);
    const completed = filterAttentionQueue(queue, 'incidents', 'completed', '');
    assert.equal(completed[0].panel?.kind, 'incident_detail');
  });
  it('searches by case-insensitive words and reference within the selected category', () => {
    const queue = buildAttentionQueue(source);
    const target = queue.find((item) => item.category === 'coverage');
    assert.ok(target);
    assert.deepEqual(filterAttentionQueue(queue, 'coverage', 'open', `  ${target.id.toLowerCase()}  `), [target]);
    assert.deepEqual(filterAttentionQueue(queue, 'approvals', 'open', target.id), []);
    assert.deepEqual(filterAttentionQueue(queue, 'all', 'open', '<script>"\'&'), []);
    assert.deepEqual(filterAttentionQueue(queue, 'all', 'open', 'x'.repeat(10000)), []);
  });
  it('routes dated guardrails to their assignment and other guardrails to the schedule', () => {
    const queue = buildAttentionQueue({ ...source, issues: [
      { id: 'issue-1', title: 'Rest', description: 'Insufficient rest', remediation: 'Review assignment', category: 'turnaround_rest', severity: 'blocking', operatorId: 'OP-1', date: '2026-10-25' },
      { id: 'issue-2', title: 'Coverage', description: 'Check staffing', remediation: 'Review roster', category: 'understaffing', severity: 'advisory' }
    ] });
    assert.equal(queue.find((item) => item.id === 'issue-1')?.panel?.secondaryId, '2026-10-25');
    assert.equal(queue.find((item) => item.id === 'issue-2')?.panel, null);
  });
});
