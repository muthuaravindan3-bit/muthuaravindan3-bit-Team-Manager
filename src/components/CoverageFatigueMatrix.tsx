import React, { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { Plus, Sparkles } from 'lucide-react';
import { UserProfile, Shift } from '../types';
import {
  LocalizedShiftRecord,
  OperatorWorkloadStats,
  ShiftIndexMap,
  getShiftBadgeStyle,
  isTimeOffShift,
  getInitials,
  getNextCycledShiftPreset,
} from '../utils/shiftTaxonomy';

interface CoverageFatigueMatrixProps {
  weekDays: Date[];
  users: UserProfile[];
  shiftIndexMap: ShiftIndexMap;
  workloadMap: Record<string, OperatorWorkloadStats>;
  currentUserId?: string;
  isAdmin: boolean;
  dailyTarget: number;
  slaMinPerWindow: number;
  searchQuery: string;
  onInspectShift?: (shift: Shift) => void;
  onCycleCellShift: (
    user: UserProfile,
    dateStr: string,
    existingShift?: LocalizedShiftRecord
  ) => void;
  onRunAutopilotWeek?: () => void;
}

export default React.memo(function CoverageFatigueMatrix({
  weekDays,
  users,
  shiftIndexMap,
  workloadMap,
  currentUserId,
  isAdmin,
  dailyTarget,
  searchQuery,
  onInspectShift,
  onCycleCellShift,
  onRunAutopilotWeek,
}: CoverageFatigueMatrixProps) {
  const weekDateStrings = useMemo(
    () => weekDays.map((d) => format(d, 'yyyy-MM-dd')),
    [weekDays]
  );

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = users.filter((u) => {
      if (!q) return true;
      const name = (u.displayName || u.email || '').toLowerCase();
      const empId = (u.employeeId || '').toLowerCase();
      return name.includes(q) || empId.includes(q);
    });

    return [...list].sort((a, b) => {
      const loadA = workloadMap[a.uid]?.weeklyHours ?? 0;
      const loadB = workloadMap[b.uid]?.weeklyHours ?? 0;
      if (loadB !== loadA) return loadB - loadA;
      return (a.displayName || a.email || '').localeCompare(
        b.displayName || b.email || ''
      );
    });
  }, [users, searchQuery, workloadMap]);

  const dailySlaStats = useMemo(() => {
    return weekDateStrings.map((dateStr) => {
      const dayShifts = shiftIndexMap.byDate.get(dateStr) || [];
      const activeCount = dayShifts.filter(
        (s) => !isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
      ).length;
      return { dateStr, activeCount };
    });
  }, [weekDateStrings, shiftIndexMap]);

  return (
    <div className="glass-card overflow-hidden">
      {/* Minimal Matrix Header */}
      <div className="px-4 py-3 border-b border-main-border flex flex-wrap items-center justify-between gap-3 bg-surface-2">
        <div className="flex items-center gap-3 text-xs text-main-text-muted">
          <span className="font-semibold text-main-text">
            7-Day Shift Matrix
          </span>
          <span>·</span>
          <span>
            {isAdmin
              ? 'Click any cell to cycle shift type · Shift+Click to inspect'
              : 'Click any cell to inspect shift details'}
          </span>
        </div>

        {isAdmin && onRunAutopilotWeek && (
          <button
            type="button"
            onClick={onRunAutopilotWeek}
            className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Autopilot Balance</span>
          </button>
        )}
      </div>

      {/* Clean Matrix Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-main-border bg-surface-1/60 text-[11px] font-medium uppercase tracking-wider text-main-text-muted">
              <th className="py-2.5 pl-4 pr-3 min-w-[200px] sticky left-0 z-10 bg-surface-2 border-r border-main-border">
                Operator
              </th>
              {weekDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <th
                    key={format(day, 'yyyy-MM-dd')}
                    className={`py-2.5 px-2 text-center min-w-[104px] ${
                      isToday ? 'text-primary font-semibold' : ''
                    }`}
                  >
                    <span>{format(day, 'EEE')}</span>{' '}
                    <span className="font-mono tabular-nums opacity-75">
                      {format(day, 'd')}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-main-border text-xs">
            {filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-xs text-main-text-muted"
                >
                  No operators match your current search filter.
                </td>
              </tr>
            ) : (
              filteredUsers.map((op) => {
                const stats = workloadMap[op.uid];
                const weeklyHours = stats?.weeklyHours ?? 0;
                const isMe = op.uid === currentUserId;
                const opName = op.displayName || op.email || 'Operator';

                return (
                  <tr
                    key={op.uid}
                    className="hover:bg-surface-3/30 transition-colors content-auto-row"
                  >
                    {/* Clean Operator Column: Avatar + Name + Unboxed Hours */}
                    <td className="py-2.5 pl-4 pr-3 align-middle sticky left-0 z-10 bg-surface-2 border-r border-main-border">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-surface-3 border border-main-border flex items-center justify-center font-display font-semibold text-[11px] text-main-text shrink-0">
                            {getInitials(opName)}
                          </div>
                          <span className="font-medium text-main-text truncate">
                            {opName}
                            {isMe && (
                              <span className="text-primary text-[10px] ml-1.5 font-normal">
                                You
                              </span>
                            )}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[11px] tabular-nums shrink-0 ${
                            weeklyHours > 40
                              ? 'text-warning font-semibold'
                              : 'text-main-text-muted'
                          }`}
                        >
                          {weeklyHours}h
                        </span>
                      </div>
                    </td>

                    {/* 7 Clean Daily Shift Cells */}
                    {weekDateStrings.map((dateStr) => {
                      const cellShifts =
                        shiftIndexMap.byUserDate.get(`${op.uid}_${dateStr}`) ||
                        [];
                      const primaryShift = cellShifts[0];

                      if (!primaryShift) {
                        return (
                          <td
                            key={dateStr}
                            className="p-1.5 align-middle text-center"
                          >
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => onCycleCellShift(op, dateStr)}
                              title={
                                isAdmin
                                  ? `Assign shift to ${opName} on ${dateStr}`
                                  : 'Unscheduled'
                              }
                              className={`w-full h-9 rounded-md flex items-center justify-center text-[11px] text-main-text-disabled transition-colors ${
                                isAdmin
                                  ? 'hover:bg-surface-3 hover:text-main-text cursor-pointer group'
                                  : 'cursor-default'
                              }`}
                            >
                              {isAdmin ? (
                                <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
                              ) : (
                                <span>—</span>
                              )}
                            </button>
                          </td>
                        );
                      }

                      const styleMeta = getShiftBadgeStyle(primaryShift.type);
                      const nextPreset = getNextCycledShiftPreset(
                        primaryShift.type
                      );

                      return (
                        <td
                          key={dateStr}
                          className="p-1.5 align-middle text-center"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              if (isAdmin && !e.shiftKey) {
                                onCycleCellShift(op, dateStr, primaryShift);
                              } else {
                                onInspectShift?.(primaryShift);
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              onInspectShift?.(primaryShift);
                            }}
                            title={
                              isAdmin
                                ? `${primaryShift.type} (${primaryShift.localStartTime}–${primaryShift.localEndTime}) · Click for ${nextPreset.id}`
                                : `${primaryShift.type} (${primaryShift.localStartTime}–${primaryShift.localEndTime})`
                            }
                            className={`w-full h-9 px-2 rounded-md border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${styleMeta.badgeClass}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${styleMeta.dotClass}`}
                            />
                            <span className="truncate">{primaryShift.type}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Clean Footer Summary Row */}
          <tfoot>
            <tr className="border-t border-main-border bg-surface-1/60 text-[11px] font-mono text-main-text-muted">
              <td className="py-2.5 pl-4 pr-3 font-sans font-medium text-main-text-muted sticky left-0 z-10 bg-surface-2 border-r border-main-border">
                Active Coverage (Target {dailyTarget}/d)
              </td>
              {dailySlaStats.map((st) => (
                <td
                  key={st.dateStr}
                  className="py-2.5 px-2 text-center tabular-nums"
                >
                  <span
                    className={
                      st.activeCount >= dailyTarget
                        ? 'text-success font-medium'
                        : 'text-main-text-muted'
                    }
                  >
                    {st.activeCount}/{dailyTarget}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
});
