import type { ScheduleScope, ShiftAssignment } from '../data/shiftSyncTypes';
import { getShiftEpochBounds } from '../utils/shiftSyncEngine';

/** Facility calendar date independent of the machine timezone. */
export function facilityDay(nowIso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(nowIso));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function facilityTime(nowIso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(nowIso));
}
export function isDaySwingOverlap(nowIso: string): boolean { const time = facilityTime(nowIso); return time >= '12:30' && time < '16:30'; }
/** Resolves all applicable published periods so overnight work survives a week boundary. */
export function publishedAssignments(scopes: Record<string, ScheduleScope>, boundary: ShiftAssignment[] = []): ShiftAssignment[] {
  const list = [...boundary, ...Object.values(scopes).flatMap((scope) => scope.publishedAssignments)];
  return [...new Map(list.map((assignment) => [`${assignment.operatorId}:${assignment.date}`, assignment])).values()];
}
export function activeAssignments(assignments: ShiftAssignment[], nowIso: string): ShiftAssignment[] {
  const now = Date.parse(nowIso);
  return assignments.filter((assignment) => { const bounds = getShiftEpochBounds(assignment.date, assignment.shiftCode); return bounds && bounds.startMs <= now && now < bounds.endMs; });
}
export function nextAssignment(assignments: ShiftAssignment[], operatorId: string, nowIso: string): ShiftAssignment | undefined {
  const now = Date.parse(nowIso);
  return assignments.filter((assignment) => assignment.operatorId === operatorId && (getShiftEpochBounds(assignment.date, assignment.shiftCode)?.startMs ?? 0) > now)
    .sort((left, right) => (getShiftEpochBounds(left.date, left.shiftCode)?.startMs ?? 0) - (getShiftEpochBounds(right.date, right.shiftCode)?.startMs ?? 0))[0];
}
