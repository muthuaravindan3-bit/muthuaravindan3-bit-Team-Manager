import { withTimeout } from '../utils/withTimeout';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkspaceLocation } from '../utils/workspaceNavigation';
import { shiftsOverlap } from '../utils/coverComparison';

test('legacy workspace URLs retain their meaning', () => {
  assert.deepEqual(readWorkspaceLocation('?workspace=needs_attention&scope=scope-2026-10-19'), { workspace: 'dashboard', view: 'attention' });
  assert.deepEqual(readWorkspaceLocation('?workspace=schedule&subview=roster_table'), { workspace: 'schedule', view: 'list' });
  assert.deepEqual(readWorkspaceLocation('?workspace=unknown&view=unexpected'), { workspace: 'dashboard', view: 'summary' });
  assert.deepEqual(readWorkspaceLocation('?workspace=schedule&view=mine'), { workspace: 'schedule', view: 'mine' });
});
test('cover comparison detects overnight conflicts on the following day', () => {
  assert.equal(shiftsOverlap({ date: '2026-10-25', startTime: '22:00', endTime: '06:00' }, { date: '2026-10-26', startTime: '05:00', endTime: '09:00' }), true);
  assert.equal(shiftsOverlap({ date: '2026-10-25', startTime: '22:00', endTime: '06:00' }, { date: '2026-10-26', startTime: '06:00', endTime: '14:00' }), false);
  assert.equal(shiftsOverlap({ date: '2026-10-25', startTime: '09:00', endTime: '17:00' }, { date: '2026-10-25', startTime: '10:00', endTime: '11:00' }), true);
});

test('SDK deadlines reject stalled operations and pass completed results', async () => {
  await assert.rejects(withTimeout(new Promise<never>(() => {}), 10), /timed out/);
  assert.equal(await withTimeout(Promise.resolve('ready'), 100), 'ready');
});
