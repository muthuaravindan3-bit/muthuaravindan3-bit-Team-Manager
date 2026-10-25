import React, { useMemo } from 'react';
import {
  Globe,
  ArrowRight,
  AlertTriangle,
  Coffee,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import { UserProfile, IncidentTicket } from '../types';
import {
  LocalizedShiftRecord,
  ShiftCategory,
  categorizeShiftType,
  computeHandoffReadiness,
  getGlobalWorldClocks,
} from '../utils/shiftTaxonomy';

interface OrbitalChronoRingProps {
  dateLabel: string;
  dayShifts: LocalizedShiftRecord[];
  users: UserProfile[];
  openIncidents: IncidentTicket[];
  slaMinPerWindow: number;
  userTimezone: string;
  nowMinutes: number;
  selectedCategory: 'all' | ShiftCategory;
  onSelectCategory: (cat: 'all' | ShiftCategory) => void;
  onOpenHandoverBoard?: () => void;
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startHour: number,
  endHour: number
): string {
  const startAngle = (startHour / 24) * 360;
  let endAngle = (endHour / 24) * 360;
  if (endAngle <= startAngle) {
    endAngle += 360;
  }
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M',
    start.x.toFixed(2),
    start.y.toFixed(2),
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x.toFixed(2),
    end.y.toFixed(2),
  ].join(' ');
}

export default React.memo(function OrbitalChronoRing({
  dateLabel,
  dayShifts,
  users,
  openIncidents,
  slaMinPerWindow,
  userTimezone,
  nowMinutes,
  selectedCategory,
  onSelectCategory,
  onOpenHandoverBoard,
}: OrbitalChronoRingProps) {
  const worldClocks = useMemo(
    () => getGlobalWorldClocks(userTimezone),
    [userTimezone, nowMinutes]
  );

  const handoffs = useMemo(
    () =>
      computeHandoffReadiness(
        dayShifts,
        users,
        openIncidents,
        slaMinPerWindow
      ),
    [dayShifts, users, openIncidents, slaMinPerWindow]
  );

  const counts = useMemo(() => {
    let first = 0;
    let second = 0;
    let third = 0;
    let general = 0;
    for (const s of dayShifts) {
      const cat = categorizeShiftType(s.type);
      if (cat === 'first') first++;
      else if (cat === 'second') second++;
      else if (cat === 'third') third++;
      else if (cat === 'general') general++;
    }
    return { first, second, third, general };
  }, [dayShifts]);

  const nowAngle = (nowMinutes / 1440) * 360;
  const needleTip = polarToCartesian(90, 90, 74, nowAngle);

  const arcs: Array<{
    id: ShiftCategory;
    label: string;
    hours: string;
    radius: number;
    startHour: number;
    endHour: number;
    stroke: string;
    count: number;
  }> = [
    {
      id: 'first',
      label: '1st Shift (Day)',
      hours: '07:30–16:30',
      radius: 70,
      startHour: 7.5,
      endHour: 16.5,
      stroke: 'var(--color-primary)',
      count: counts.first,
    },
    {
      id: 'second',
      label: '2nd Shift (Swing)',
      hours: '12:30–20:30',
      radius: 58,
      startHour: 12.5,
      endHour: 20.5,
      stroke: 'var(--color-secondary)',
      count: counts.second,
    },
    {
      id: 'third',
      label: '3rd Shift (Night)',
      hours: '20:30–07:30',
      radius: 46,
      startHour: 20.5,
      endHour: 31.5,
      stroke: 'var(--color-info)',
      count: counts.third,
    },
    {
      id: 'general',
      label: 'General',
      hours: '09:00–18:00',
      radius: 34,
      startHour: 9,
      endHour: 18,
      stroke: 'var(--color-warning)',
      count: counts.general,
    },
  ];

  const nowFormatted = `${String(Math.floor(nowMinutes / 60)).padStart(
    2,
    '0'
  )}:${String(nowMinutes % 60).padStart(2, '0')}`;

  return (
    <div className="glass-card cyber-grid-bg p-4 sm:p-5 space-y-4">
      {/* Top Row: Global Multi-Timezone Synchronization Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-main-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary-subtle border border-primary/30 flex items-center justify-center text-primary shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-display font-bold text-main-text tracking-tight">
              24-Hour Orbital Chrono-Ring & Shift Handoff Readiness
            </h3>
            <p className="text-[11px] text-main-text-muted">
              {dateLabel} · Click any orbital arc to filter · Live handoffs at 07:30, 12:30 & 20:30
            </p>
          </div>
        </div>

        {/* Multi-Timezone World Clock Strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-primary mr-0.5 hidden sm:inline" />
          {worldClocks.map((wc) => (
            <div
              key={wc.id}
              className={`px-2 py-1 rounded-lg border text-[11px] font-mono tabular-nums flex items-center gap-1.5 ${
                wc.id === 'local'
                  ? 'bg-primary-subtle border-primary/35 text-primary font-semibold'
                  : 'bg-surface-1/80 border-main-border text-main-text-muted'
              }`}
            >
              <span className="text-[10px] opacity-80">{wc.label}</span>
              <span className="font-bold text-main-text">{wc.timeStr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Split: Left Orbital 24h Chrono-Ring + Right Handoff Boundary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left 5 Cols: Interactive SVG 24h Orbital Dial + Legend */}
        <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl bg-surface-1/75 border border-main-border">
          <div className="relative w-40 h-40 shrink-0">
            <svg viewBox="0 0 180 180" className="w-full h-full">
              {/* Outer 24h Reference Ring */}
              <circle
                cx="90"
                cy="90"
                r="78"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="2 4"
                className="text-main-border"
              />

              {/* Background Tracks */}
              {arcs.map((a) => (
                <circle
                  key={`track-${a.id}`}
                  cx="90"
                  cy="90"
                  r={a.radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-surface-3"
                />
              ))}

              {/* Highlighted Handover Overlap Zone: 1st & 2nd Shift Surge (12:30–16:30) */}
              <path
                d={describeArc(90, 90, 64, 12.5, 16.5)}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2.5"
                strokeDasharray="3 3"
                className="opacity-70"
              >
                <title>Overlap Surge: 1st + 2nd Shift (12:30–16:30)</title>
              </path>

              {/* Active Shift Window Arcs */}
              {arcs.map((a) => {
                const isSelected = selectedCategory === a.id;
                const isDimmed =
                  selectedCategory !== 'all' && selectedCategory !== a.id;
                return (
                  <path
                    key={a.id}
                    d={describeArc(90, 90, a.radius, a.startHour, a.endHour)}
                    fill="none"
                    stroke={a.stroke}
                    strokeWidth={isSelected ? '8' : '6'}
                    strokeLinecap="round"
                    style={{
                      opacity: isDimmed ? 0.25 : 0.95,
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      onSelectCategory(isSelected ? 'all' : a.id)
                    }
                  />
                );
              })}

              {/* Cardinal & Key Handoff Hour Markers */}
              <text
                x="90"
                y="10"
                textAnchor="middle"
                className="fill-main-text-muted font-mono text-[8px]"
              >
                00:00
              </text>
              <text
                x="172"
                y="93"
                textAnchor="end"
                className="fill-primary font-mono text-[8px] font-bold"
              >
                07:30
              </text>
              <text
                x="90"
                y="176"
                textAnchor="middle"
                className="fill-secondary font-mono text-[8px] font-bold"
              >
                12:30
              </text>
              <text
                x="8"
                y="93"
                textAnchor="start"
                className="fill-info font-mono text-[8px] font-bold"
              >
                20:30
              </text>

              {/* Sweeping Local Time Vector Needle */}
              <line
                x1="90"
                y1="90"
                x2={needleTip.x}
                y2={needleTip.y}
                stroke="var(--color-primary)"
                strokeWidth="1.75"
                strokeDasharray="3 2"
              />
              <circle
                cx={needleTip.x}
                cy={needleTip.y}
                r="3.2"
                fill="var(--color-primary)"
              />
              <circle
                cx="90"
                cy="90"
                r="19"
                fill="var(--color-surface-2)"
                stroke="var(--color-main-border)"
                strokeWidth="1"
              />
              <text
                x="90"
                y="88"
                textAnchor="middle"
                className="fill-main-text font-mono text-[9px] font-bold"
              >
                {nowFormatted}
              </text>
              <text
                x="90"
                y="98"
                textAnchor="middle"
                className="fill-primary font-mono text-[7px]"
              >
                LIVE
              </text>
            </svg>
          </div>

          {/* Orbital Arc Legend & Interactive Filter Buttons */}
          <div className="flex-1 w-full space-y-1.5">
            {arcs.map((a) => {
              const isSelected = selectedCategory === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    onSelectCategory(isSelected ? 'all' : a.id)
                  }
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between text-xs transition-transform cursor-pointer ${
                    isSelected
                      ? 'bg-surface-2 border-primary shadow-xs'
                      : 'bg-surface-2/60 border-main-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: a.stroke }}
                    />
                    <span className="font-semibold text-main-text truncate">
                      {a.label}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-main-text-muted">
                      {a.hours}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold tabular-nums text-main-text ml-2">
                    {a.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 7 Cols: 3 Shift Handoff Boundary Readiness Cards (07:30, 12:30, 20:30) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {handoffs.map((h) => {
            const isReady = h.status === 'ready';
            const isCaution = h.status === 'caution';
            return (
              <div
                key={h.id}
                className="p-3.5 rounded-xl bg-surface-1/80 border border-main-border flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold tabular-nums text-primary">
                      {h.label}
                    </span>
                    <span
                      className={`font-mono text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
                        isReady
                          ? 'bg-success-subtle text-success'
                          : isCaution
                          ? 'bg-warning-subtle text-warning'
                          : 'bg-error-subtle text-error'
                      }`}
                    >
                      {h.readinessScore}% Ready
                    </span>
                  </div>

                  <div className="text-xs font-display font-semibold text-main-text">
                    {h.transitionTitle}
                  </div>

                  {/* Outgoing vs Incoming Crew Meter */}
                  <div className="pt-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-main-text-muted">
                    <span>Out: {h.outgoingCount}</span>
                    <span>→</span>
                    <span
                      className={
                        h.incomingCount >= slaMinPerWindow
                          ? 'text-secondary font-semibold'
                          : 'text-error font-semibold'
                      }
                    >
                      In: {h.incomingCount}/{slaMinPerWindow}
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                    <div
                      style={{ width: `${h.readinessScore}%` }}
                      className={`h-full rounded-full ${
                        isReady
                          ? 'bg-secondary'
                          : isCaution
                          ? 'bg-warning'
                          : 'bg-error'
                      }`}
                    />
                  </div>
                </div>

                {/* Risk Indicators or Nominal Status */}
                <div className="pt-2 border-t border-main-border flex items-center justify-between text-[11px]">
                  {h.activeBreakConflicts > 0 ? (
                    <span className="text-warning font-medium inline-flex items-center gap-1">
                      <Coffee className="w-3 h-3" />
                      {h.activeBreakConflicts} on break
                    </span>
                  ) : h.openIncidentCount > 0 ? (
                    <button
                      type="button"
                      onClick={onOpenHandoverBoard}
                      className="text-warning hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>
                        {h.openIncidentCount} incident
                        {h.openIncidentCount > 1 ? 's' : ''}
                      </span>
                    </button>
                  ) : (
                    <span className="text-secondary font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Handoff clear
                    </span>
                  )}

                  {onOpenHandoverBoard && (
                    <button
                      type="button"
                      onClick={onOpenHandoverBoard}
                      className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Board</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
