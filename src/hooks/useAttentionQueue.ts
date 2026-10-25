import { useMemo, useState } from 'react';
import { useShiftSync } from '../context/ShiftSyncContext';
import { buildAttentionQueue, filterAttentionQueue } from '../utils/attentionQueue';
import type { AttentionCategory, AttentionItem, AttentionStatus } from '../types/attention';

/** Owns inbox filters and routes each record to its existing review workflow. */
export function useAttentionQueue() {
  const { coverageGaps, leaveRequests, shiftTrades, incidents, validationResults, operators, setSupportingPanel, setActiveWorkspace } = useShiftSync();
  const [category, setCategory] = useState<AttentionCategory>('all');
  const [status, setStatus] = useState<AttentionStatus>('open');
  const [query, setQuery] = useState('');
  const items = useMemo(() => buildAttentionQueue({ coverageGaps, leaveRequests, shiftTrades, incidents, issues: Object.values(validationResults).flatMap((result) => result.issues).filter((issue) => issue.category !== 'understaffing' || !coverageGaps.some((gap) => gap.date === issue.date && gap.zone === issue.zone)), operators }),
    [coverageGaps, leaveRequests, shiftTrades, incidents, validationResults, operators]);
  const visibleItems = useMemo(() => filterAttentionQueue(items, category, status, query), [items, category, status, query]);
  const counts = { all: 0, coverage: 0, approvals: 0, guardrails: 0, incidents: 0 };
  for (const item of items) {
    if (item.status === status) { counts.all += 1; counts[item.category] += 1; }
  }
  const openItems = items.filter((item) => item.status === 'open');
  function openItem(item: AttentionItem) {
    if (item.panel) setSupportingPanel(item.panel);
    else setActiveWorkspace('schedule');
  }
  function clearFilters() { setCategory('all'); setQuery(''); }
  return { category, setCategory, status, setStatus, query, setQuery, visibleItems, counts, openItems,
    completedCount: items.length - openItems.length, criticalCount: openItems.filter((item) => item.priority === 'critical').length,
    openItem, clearFilters, openSchedule: () => setActiveWorkspace('schedule') };
}
