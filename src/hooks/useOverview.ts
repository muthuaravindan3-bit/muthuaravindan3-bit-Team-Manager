import { useMemo } from 'react';
import { useShiftSync } from '../context/ShiftSyncContext';
import { activeAssignments, facilityDay, facilityTime, isDaySwingOverlap, nextAssignment, publishedAssignments } from '../services/operationalSelectors';
import { staffingAt } from '../services/schedulingPolicy';
import { BOUNDARY_ASSIGNMENTS } from '../data/shiftSyncSeed';

export function useOverview() {
  const context = useShiftSync();
  const { scopes, demoNowIso, activePersona, operators, leaveRequests, shiftTrades, rulesConfig } = context;
  const published = useMemo(() => publishedAssignments(scopes, BOUNDARY_ASSIGNMENTS), [scopes]);
  const active = useMemo(() => activeAssignments(published, demoNowIso), [published, demoNowIso]);
  const next = nextAssignment(published, activePersona.operatorId, demoNowIso);
  const current = active.find((assignment) => assignment.operatorId === activePersona.operatorId);
  const day = facilityDay(demoNowIso);
  const period = Object.values(scopes).find((scope) => scope.days.includes(day)) ?? context.activeScope;
  const staffed = staffingAt(published, operators, Date.parse(demoNowIso), undefined, undefined, true);
  const isOverlap = isDaySwingOverlap(demoNowIso);
  const target = isOverlap ? rulesConfig.preferredFloorTarget : active.length;
  const pending = leaveRequests.filter((request) => request.status === 'Pending Approval').length + shiftTrades.filter((trade) => trade.status === 'Supervisor Review').length;
  return { ...context, published, active, current, next, day, period, staffed, target, pending, isOverlap, time: facilityTime(demoNowIso) };
}
