import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Plus,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  Users,
  Sun,
  Sunset,
  Moon,
  Briefcase,
  CalendarOff,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isSameDay } from 'date-fns';
import { Shift, UserProfile } from '../types';
import {
  categorizeShiftType,
  isTimeOffShift,
  computeMiniBarSegments,
  computeActiveShiftProgress,
  getInitials,
  getShiftBadgeStyle,
} from '../utils/shiftTaxonomy';

export interface LocalizedShift extends Shift {
  localDate: string;
  localStartTime: string;
  localEndTime: string;
}

interface ShiftTimeline24hProps {
  weekDays: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  shifts: LocalizedShift[];
  users: UserProfile[];
  currentUserId?: string;
  isAdmin: boolean;
  userTimezone: string;
  dailyTarget: number;
  onChangeDailyTarget: (target: number) => void;
  onInspectShift?: (shift: Shift) => void;
  onQuickAssignWindow?: (params: {
    userId: string;
    dateStr: string;
    type: string;
    startTime: string;
    endTime: string;
  }) => Promise<void>;
}

const SHIFT_WINDOWS = [
  {
    id: '1st Shift',
    category: 'first' as const,
    label: '1st Shift · Morning',
    shortLabel: '1st Shift',
    hours: '06:00 – 14:00',
    defaultStart: '06:00',
    defaultEnd: '14:00',
    icon: Sun,
  },
  {
    id: '2nd Shift',
    category: 'second' as const,
    label: '2nd Shift · Afternoon',
    shortLabel: '2nd Shift',
    hours: '14:00 – 22:00',
    defaultStart: '14:00',
    defaultEnd: '22:00',
    icon: Sunset,
  },
  {
    id: '3rd Shift',
    category: 'third' as const,
    label: '3rd Shift · Night',
    shortLabel: '3rd Shift',
    hours: '22:00 – 06:00',
    defaultStart: '22:00',
    defaultEnd: '06:00',
    icon: Moon,
  },
  {
    id: 'General',
    category: 'general' as const,
    label: 'General · Day',
    shortLabel: 'General',
    hours: '09:00 – 18:00',
    defaultStart: '09:00',
    defaultEnd: '18:00',
    icon: Briefcase,
  },
] as const;

export default function ShiftTimeline24h({
  weekDays,
  selectedDate,
  onSelectDate,
  shifts,
  users,
  currentUserId,
  isAdmin,
  userTimezone,
  dailyTarget,
  onChangeDailyTarget,
  onInspectShift,
  onQuickAssignWindow,
}: ShiftTimeline24hProps) {
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  const [assigningWindow, setAssigningWindow] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  useEffect(() => {
    if (users.length > 0 && !selectedUserId) {
      setSelectedUserId(users[0].uid);
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isSelectedToday = isSameDay(selectedDate, new Date());
  const nowPct = (nowMinutes / 1440) * 100;
  const nowFormatted = `${String(Math.floor(nowMinutes / 60)).padStart(
    2,
    '0'
  )}:${String(nowMinutes % 60).padStart(2, '0')}`;

  const dayShifts = useMemo(
    () => shifts.filter((s) => s.localDate === selectedDateStr),
    [shifts, selectedDateStr]
  );

  const activeDayShifts = useMemo(
    () =>
      dayShifts.filter(
        (s) => !isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
      ),
    [dayShifts]
  );

  const restDayShifts = useMemo(
    () =>
      dayShifts.filter((s) =>
        isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
      ),
    [dayShifts]
  );

  const perWindowTarget = Math.max(1, Math.round(dailyTarget / 3));

  const windowStats = useMemo(() => {
    return SHIFT_WINDOWS.map((win) => {
      const matching = dayShifts.filter(
        (s) => categorizeShiftType(s.type) === win.category
      );
      const count = matching.length;
      const target = win.category === 'general' ? Math.max(1, Math.floor(perWindowTarget / 2)) : perWindowTarget;
      const pct = Math.min(100, Math.round((count / target) * 100));
      return {
        ...win,
        shifts: matching,
        count,
        target,
        pct,
      };
    });
  }, [dayShifts, perWindowTarget]);

  const totalDayAssigned = activeDayShifts.length;
  const totalDayPct = Math.min(
    100,
    Math.round((totalDayAssigned / Math.max(1, dailyTarget)) * 100)
  );

  const handleConfirmQuickAssign = async (
    win: (typeof SHIFT_WINDOWS)[number]
  ) => {
    if (!onQuickAssignWindow || !selectedUserId || submittingAssign) return;
    setSubmittingAssign(true);
    try {
      await onQuickAssignWindow({
        userId: selectedUserId,
        dateStr: selectedDateStr,
        type: win.id,
        startTime: win.defaultStart,
        endTime: win.defaultEnd,
      });
      setAssigningWindow(null);
    } finally {
      setSubmittingAssign(false);
    }
  };

  const rulerHours = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="glass-card p-5 space-y-5">
      {/* Header Row: Title, Live Status Badge & Daily Target Control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-main-border">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-display font-bold text-main-text">
              24-Hour Shift Timeline & Coverage Band
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold tabular-nums border ${
                totalDayPct >= 100
                  ? 'bg-success-subtle text-success border-success/30'
                  : totalDayPct >= 65
                  ? 'bg-warning-subtle text-warning border-warning/30'
                  : 'bg-error-subtle text-error border-error/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  totalDayPct >= 100
                    ? 'bg-success'
                    : totalDayPct >= 65
                    ? 'bg-warning'
                    : 'bg-error'
                }`}
              />
              {totalDayAssigned}/{dailyTarget} Active · {totalDayPct}%
            </span>
            {restDayShifts.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-3 border border-main-border text-main-text-muted font-mono text-[11px] font-medium tabular-nums">
                <CalendarOff className="w-3 h-3" />
                {restDayShifts.length} WO/CO
              </span>
            )}
            {isSelectedToday && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary-subtle border border-secondary/30 text-secondary font-mono text-[11px] font-semibold tabular-nums">
                <Clock className="w-3 h-3" />
                Live {nowFormatted}
              </span>
            )}
          </div>
          <p className="text-xs text-main-text-muted">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')} · {userTimezone} · 1st
            06:00–14:00 · 2nd 14:00–22:00 · 3rd 22:00–06:00 · General
            09:00–18:00
          </p>
        </div>

        {/* Day Selector Strip + Daily Target Stepper */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl bg-surface-1 p-1 border border-main-border overflow-x-auto max-w-full">
            {weekDays.map((d) => {
              const dStr = format(d, 'yyyy-MM-dd');
              const isSelected = dStr === selectedDateStr;
              const isToday = isSameDay(d, new Date());
              const countForDay = shifts.filter(
                (s) =>
                  s.localDate === dStr &&
                  !isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
              ).length;

              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => onSelectDate(d)}
                  className={`relative px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'text-primary-text font-semibold'
                      : 'text-main-text-muted hover:text-main-text'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="timeline-day-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 32,
                      }}
                      className="absolute inset-0 rounded-lg bg-primary shadow-xs"
                    />
                  )}
                  <span className="relative z-10">{format(d, 'EEE d')}</span>
                  <span
                    className={`relative z-10 font-mono text-[10px] tabular-nums px-1 rounded ${
                      isSelected
                        ? 'bg-black/20 text-primary-text'
                        : isToday
                        ? 'bg-secondary-subtle text-secondary font-bold'
                        : 'bg-surface-3 text-main-text-muted'
                    }`}
                  >
                    {countForDay}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Target Headcount Adjuster */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-1 border border-main-border text-xs">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span className="text-main-text-muted">Target:</span>
            <button
              type="button"
              onClick={() => onChangeDailyTarget(Math.max(3, dailyTarget - 3))}
              className="w-5 h-5 rounded bg-surface-2 hover:bg-surface-3 text-main-text font-mono font-bold flex items-center justify-center cursor-pointer"
              aria-label="Decrease daily target"
            >
              -
            </button>
            <span className="font-mono font-bold tabular-nums text-main-text min-w-[2ch] text-center">
              {dailyTarget}
            </span>
            <button
              type="button"
              onClick={() => onChangeDailyTarget(Math.min(24, dailyTarget + 3))}
              className="w-5 h-5 rounded bg-surface-2 hover:bg-surface-3 text-main-text font-mono font-bold flex items-center justify-center cursor-pointer"
              aria-label="Increase daily target"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 4 Shift Window Coverage Summary Cards (1st, 2nd, 3rd, General) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {windowStats.map((win) => {
          const WinIcon = win.icon;
          const isHealthy = win.count >= win.target;
          const isPartial = win.count > 0 && win.count < win.target;

          return (
            <div
              key={win.id}
              className="p-3.5 rounded-xl bg-surface-1/90 border border-main-border space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary-subtle border border-primary/25 flex items-center justify-center text-primary shrink-0">
                    <WinIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-display font-bold text-main-text truncate">
                      {win.label}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-main-text-muted">
                      {win.hours}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`font-mono text-xs font-bold tabular-nums ${
                      isHealthy
                        ? 'text-success'
                        : isPartial
                        ? 'text-warning'
                        : 'text-error'
                    }`}
                  >
                    {win.count}/{win.target}
                  </span>
                  {isAdmin && onQuickAssignWindow && (
                    <button
                      type="button"
                      onClick={() =>
                        setAssigningWindow(
                          assigningWindow === win.id ? null : win.id
                        )
                      }
                      title={`Assign ${win.shortLabel} operator`}
                      className="p-1 rounded-lg bg-surface-2 hover:bg-primary hover:text-primary-text border border-main-border text-main-text-muted transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Coverage Bar */}
              <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.max(0.04, win.pct / 100) }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className={`h-full origin-left rounded-full ${
                    isHealthy
                      ? 'bg-success'
                      : isPartial
                      ? 'bg-warning'
                      : 'bg-error'
                  }`}
                />
              </div>

              {/* Inline Admin Quick-Assign Popover inside Window Card */}
              <AnimatePresence>
                {assigningWindow === win.id && isAdmin && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="pt-2 border-t border-main-border flex items-center gap-1.5"
                  >
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      aria-label={`Select operator for ${win.shortLabel}`}
                      className="flex-1 bg-surface-2 border border-main-border rounded-lg px-2 py-1 text-xs text-main-text focus:outline-none focus:border-primary"
                    >
                      {users.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName || u.email}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={submittingAssign}
                      onClick={() => handleConfirmQuickAssign(win)}
                      className="btn-primary py-1 px-2.5 text-[11px] whitespace-nowrap cursor-pointer"
                    >
                      {submittingAssign ? 'Adding…' : 'Assign'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssigningWindow(null)}
                      className="p-1 text-main-text-muted hover:text-main-text cursor-pointer"
                      aria-label="Cancel quick assign"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* 24-Hour Horizontal Ruler & Operator Swimlanes */}
      <div className="rounded-xl bg-surface-1 border border-main-border overflow-x-auto">
        <div className="min-w-[680px] p-4 space-y-3 relative">
          {/* 00:00 to 24:00 Time Ruler */}
          <div className="grid grid-cols-[190px_1fr] items-center gap-4 pb-2 border-b border-main-border">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-main-text-muted">
              Operator / Shift
            </div>
            <div className="relative h-6">
              {rulerHours.map((hr) => {
                const leftPct = (hr / 24) * 100;
                return (
                  <div
                    key={hr}
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                  >
                    <span className="font-mono text-[10px] tabular-nums text-main-text-muted">
                      {String(hr).padStart(2, '0')}:00
                    </span>
                    <span className="w-px h-1.5 bg-main-border mt-0.5" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Master 24h Window Band Background Track */}
          <div className="grid grid-cols-[190px_1fr] items-center gap-4">
            <div className="text-xs font-semibold text-main-text flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Shift Windows</span>
            </div>
            <div className="relative h-7 rounded-lg bg-surface-2 border border-main-border overflow-hidden">
              {/* 3rd Shift 00:00 - 06:00 */}
              <div
                style={{ left: '0%', width: '25%' }}
                className="absolute inset-y-0 bg-info-subtle/60 border-r border-main-border flex items-center justify-center text-[10px] font-mono text-info"
              >
                3rd (00–06)
              </div>
              {/* 1st Shift 06:00 - 14:00 */}
              <div
                style={{ left: '25%', width: '33.333%' }}
                className="absolute inset-y-0 bg-primary-subtle/70 border-r border-main-border flex items-center justify-center text-[10px] font-mono font-semibold text-primary"
              >
                1st Shift (06–14)
              </div>
              {/* 2nd Shift 14:00 - 22:00 */}
              <div
                style={{ left: '58.333%', width: '33.333%' }}
                className="absolute inset-y-0 bg-secondary-subtle/70 border-r border-main-border flex items-center justify-center text-[10px] font-mono font-semibold text-secondary"
              >
                2nd Shift (14–22)
              </div>
              {/* 3rd Shift 22:00 - 24:00 */}
              <div
                style={{ left: '91.666%', width: '8.334%' }}
                className="absolute inset-y-0 bg-info-subtle/60 flex items-center justify-center text-[10px] font-mono text-info"
              >
                22–24
              </div>

              {/* Live Now Marker on Band */}
              {isSelectedToday && (
                <div
                  style={{ left: `${nowPct}%` }}
                  className="absolute inset-y-0 w-0.5 bg-secondary z-20"
                  title={`Current time: ${nowFormatted}`}
                />
              )}
            </div>
          </div>

          {/* Individual Operator Swimlanes */}
          {dayShifts.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-warning mx-auto" />
              <p className="text-xs font-semibold text-main-text">
                No operators assigned on {format(selectedDate, 'MMM d, yyyy')}
              </p>
              <p className="text-[11px] text-main-text-muted">
                {isAdmin
                  ? 'Click the + button on any shift window card above to assign an operator immediately.'
                  : 'Select another day on the pill bar above to inspect scheduled coverage.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-main-border/60">
              {dayShifts.map((shift) => {
                const member = users.find((u) => u.uid === shift.userId);
                const isOnBreak = Boolean(member?.isBreakActive);
                const isMine = shift.userId === currentUserId;
                const isRest = isTimeOffShift(
                  shift.type,
                  shift.localStartTime,
                  shift.localEndTime
                );
                const segments = computeMiniBarSegments(
                  shift.localStartTime,
                  shift.localEndTime,
                  shift.type
                );
                const liveProgress = computeActiveShiftProgress(
                  shift.localDate,
                  shift.localStartTime,
                  shift.localEndTime,
                  shift.type,
                  todayStr,
                  nowMinutes
                );
                const styleMeta = getShiftBadgeStyle(shift.type);

                return (
                  <div
                    key={shift.id}
                    onClick={() => onInspectShift?.(shift)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onInspectShift?.(shift);
                      }
                    }}
                    className="grid grid-cols-[190px_1fr] items-center gap-4 py-2.5 hover:bg-surface-2/60 rounded-lg px-1.5 transition-colors cursor-pointer group"
                  >
                    {/* Operator Identity Column */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary-subtle border border-primary/25 flex items-center justify-center font-display font-bold text-[11px] text-primary shrink-0">
                        {getInitials(shift.userName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-main-text truncate group-hover:text-primary transition-colors">
                            {shift.userName}
                          </span>
                          {isMine && (
                            <span className="text-[10px] font-semibold text-primary shrink-0">
                              · You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-main-text-muted">
                          <span className="truncate">{shift.type}</span>
                          <span>·</span>
                          {isRest ? (
                            <span className="text-main-text-muted font-medium">
                              Rest Day
                            </span>
                          ) : isOnBreak ? (
                            <span className="text-warning font-semibold inline-flex items-center gap-1">
                              <Coffee className="w-3 h-3" />
                              Break
                            </span>
                          ) : liveProgress.isLiveNow ? (
                            <span className="text-success font-semibold">
                              On Duty ({liveProgress.elapsedPct}%)
                            </span>
                          ) : (
                            <span className="text-main-text-muted">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 24h Horizontal Lane Track */}
                    <div className="relative h-8 rounded-lg bg-surface-2/80 border border-main-border overflow-hidden">
                      {/* Subtle 6-hour grid lines */}
                      {[25, 50, 75].map((pct) => (
                        <div
                          key={pct}
                          style={{ left: `${pct}%` }}
                          className="absolute inset-y-0 w-px bg-main-border/50"
                        />
                      ))}

                      {/* Shift Bar Segments */}
                      {segments.map((seg, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scaleX: 0.92 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 380,
                            damping: 30,
                          }}
                          style={{
                            left: `${seg.leftPct}%`,
                            width: `${seg.widthPct}%`,
                          }}
                          className={`absolute inset-y-1 rounded-md px-2.5 flex items-center justify-between text-[11px] font-mono font-semibold tabular-nums shadow-xs origin-left ${
                            seg.isRest
                              ? 'bg-surface-3/70 border border-dashed border-main-border text-main-text-muted'
                              : isOnBreak
                              ? 'bg-warning-subtle border border-warning/50 text-warning'
                              : isMine
                              ? 'bg-primary text-primary-text'
                              : styleMeta.badgeClass + ' border'
                          }`}
                        >
                          <span className="truncate">
                            {seg.isRest
                              ? `${shift.type} — Rest / Time Off`
                              : `${shift.localStartTime} – ${shift.localEndTime}`}
                          </span>
                          <span className="hidden sm:inline text-[10px] opacity-85 ml-2 shrink-0">
                            {liveProgress.isLiveNow
                              ? `${liveProgress.remainingLabel}`
                              : shift.type}
                          </span>
                        </motion.div>
                      ))}

                      {/* Live Current Time Playhead Line */}
                      {isSelectedToday && (
                        <div
                          style={{ left: `${nowPct}%` }}
                          className="absolute inset-y-0 w-0.5 bg-secondary z-20 pointer-events-none"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
