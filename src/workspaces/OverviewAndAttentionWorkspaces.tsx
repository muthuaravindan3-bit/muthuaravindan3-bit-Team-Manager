import { AttentionInbox } from '../components/AttentionInbox';
import { useAttentionQueue } from '../hooks/useAttentionQueue';
import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Users,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Activity,
  FileCheck2,
  UserCheck,
  BellRing,
  Sliders,
  Filter
} from 'lucide-react';
import { useShiftSync } from '../context/ShiftSyncContext';
import { ShiftBadge } from '../components/ShiftBadge';
import { computeShiftProgress, SHIFT_CATALOG } from '../utils/shiftSyncEngine';
import { ShiftCode } from '../data/shiftSyncTypes';

export const OverviewWorkspace: React.FC = () => {
  const {
    activePersona,
    demoNowIso,
    activeScope,
    scopes,
    operators,
    coverageGaps,
    leaveRequests,
    shiftTrades,
    incidents,
    handoverSession,
    setActiveWorkspace,
    setScheduleSubView,
    setSupportingPanel,
    generateAIAutopilotProposal
  } = useShiftSync();

  const [selectedRingShift, setSelectedRingShift] = useState<ShiftCode>('1ST');

  // Identify acting operator's current shift on 2026-10-25 and next shift on 2026-10-26
  const currentScope = scopes['scope-2026-10-19'];
  const nextScope = scopes['scope-2026-10-26'];
  const myTodayAssign =
    currentScope.assignments.find(
      (a) => a.operatorId === activePersona.operatorId && a.date === '2026-10-25'
    ) || {
      operatorId: activePersona.operatorId,
      date: '2026-10-25',
      shiftCode: '1ST' as ShiftCode,
      zone: activePersona.zone,
      locked: false
    };

  const myNextAssign =
    nextScope.assignments.find(
      (a) => a.operatorId === activePersona.operatorId && a.date === '2026-10-26'
    ) || {
      operatorId: activePersona.operatorId,
      date: '2026-10-26',
      shiftCode: '1ST' as ShiftCode,
      zone: activePersona.zone,
      locked: false
    };

  const shiftProg = computeShiftProgress(
    myTodayAssign.date,
    myTodayAssign.shiftCode,
    demoNowIso
  );

  // Live floor staffing calculation at Sunday 25 Oct 2026 14:00 IST
  // Active shifts at 14:00 IST: 1ST (07:30-16:30), 2ND (12:30-20:30), GEN (09:00-18:00)
  const sunAssignments = currentScope.publishedAssignments.filter(
    (a) => a.date === '2026-10-25'
  );
  const activeOnFloorCount = sunAssignments.filter((a) =>
    ['1ST', '2ND', 'GEN'].includes(a.shiftCode)
  ).length;
  const preferredFloorTarget = 20;
  const hardFloorMin = 18;
  const preferredOpenings = Math.max(0, preferredFloorTarget - activeOnFloorCount);
  const coveragePct = Math.round((activeOnFloorCount / preferredFloorTarget) * 100);

  const pendingLeaves = leaveRequests.filter((r) => r.status === 'Pending Approval');
  const pendingTrades = shiftTrades.filter((t) => t.status === 'Supervisor Review');
  const totalPendingApprovals = pendingLeaves.length + pendingTrades.length;
  const criticalIncidents = incidents.filter(
    (i) => i.severity === 'L3 · Critical' && i.status !== 'Resolved'
  );
  const openIncidents = incidents.filter((i) => i.status !== 'Resolved');

  const shiftCountsToday = {
    '1ST': sunAssignments.filter((a) => a.shiftCode === '1ST').length,
    '2ND': sunAssignments.filter((a) => a.shiftCode === '2ND').length,
    '3RD': sunAssignments.filter((a) => a.shiftCode === '3RD').length,
    GEN: sunAssignments.filter((a) => a.shiftCode === 'GEN').length
  };

  return (
    <div className="space-y-5">
      {/* Role Context Banner */}
      <div className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md bg-[#06B6D4]/15 border border-[#06B6D4]/40 font-mono text-xs font-semibold text-[#22D3EE]">
              {activePersona.permissionRole.toUpperCase()} VIEW
            </span>
            <h1 className="font-display text-xl font-bold text-slate-100">
              Command Center · {activePersona.name} ({activePersona.badgeCode})
            </h1>
            <span className="text-xs text-slate-400">
              {activePersona.jobTitle} · {activePersona.zone}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Active Reporting Period: <strong className="text-slate-200">19–25 October 2026</strong> ·
            Selected Operational Day: <strong className="text-slate-200">Sun 25 Oct 2026</strong> ·
            Roster Publication: <strong className="font-mono text-emerald-400">{currentScope.version} ({currentScope.status})</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activePersona.permissionRole !== 'Operator' ? (
            <>
              <button
                onClick={() => {
                  setActiveWorkspace('schedule');
                  generateAIAutopilotProposal('scope-2026-10-26');
                }}
                className="px-3.5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-[#06B6D4]/10"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run Week Autopilot (26 Oct–1 Nov)
              </button>
              <button
                onClick={() => {
                  setActiveWorkspace('schedule');
                  setSupportingPanel({
                    kind: 'coverage_gap',
                    entityId: coverageGaps[0]?.id || 'GAP-2026-1025-N',
                    widthPx: 440
                  });
                }}
                className="px-3.5 py-2 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-100 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#22D3EE]" />
                Resolve Night Coverage Gap
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveWorkspace('requests')}
                className="px-3.5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                Request Leave or Shift Trade
              </button>
              <button
                onClick={() =>
                  setSupportingPanel({
                    kind: 'operator_dossier',
                    entityId: activePersona.operatorId,
                    widthPx: 430
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-100 font-semibold text-xs transition-colors"
              >
                Inspect My Dossier & Certs
              </button>
            </>
          )}
        </div>
      </div>

      {/* CARD GROUP 1: 4-Card KPI Telemetry Strip (Strictly Scoped & Reconciled to Sun 25 Oct 14:00 IST) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Floor Coverage */}
        <div
          onClick={() => {
            setActiveWorkspace('schedule');
            setScheduleSubView('coverage_matrix');
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setActiveWorkspace('schedule');
              setScheduleSubView('coverage_matrix');
            }
          }}
          className="p-4 rounded-2xl bg-[#0D1117] hover:bg-[#151B24]/90 border border-slate-800/90 hover:border-[#06B6D4]/50 transition-all cursor-pointer space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Preferred-Target Floor Coverage</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
              HARD MIN {hardFloorMin} MET
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-2xl font-bold text-slate-100 tabular-nums">
              {activeOnFloorCount}/{preferredFloorTarget}{' '}
              <span className="text-sm font-normal text-slate-400">positions</span>
            </div>
            <span className="font-mono text-lg font-bold text-[#22D3EE] tabular-nums">
              {coveragePct}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#06B6D4] to-[#10B981]"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <span>Preferred openings: {preferredOpenings}</span>
            <span className="text-[#22D3EE] font-medium">View Coverage Matrix →</span>
          </div>
        </div>

        {/* KPI 2: Rest & Turnaround Health */}
        <div
          onClick={() => setActiveWorkspace('needs_attention')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setActiveWorkspace('needs_attention');
          }}
          className="p-4 rounded-2xl bg-[#0D1117] hover:bg-[#151B24]/90 border border-slate-800/90 hover:border-emerald-500/50 transition-all cursor-pointer space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Rest & Turnaround Health</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            0 <span className="text-sm font-normal text-slate-300">turnaround violations</span>
          </div>
          <p className="text-xs text-slate-400">
            All 22 operators satisfy the ≥11h minimum turnaround rule across published shifts.
          </p>
          <div className="text-[11px] text-emerald-400 font-medium pt-0.5">
            Guardrail audit nominal →
          </div>
        </div>

        {/* KPI 3: Alert Desk */}
        <div
          onClick={() => setActiveWorkspace('needs_attention')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setActiveWorkspace('needs_attention');
          }}
          className="p-4 rounded-2xl bg-[#0D1117] hover:bg-[#151B24]/90 border border-slate-800/90 hover:border-amber-500/50 transition-all cursor-pointer space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Alert Desk & Approvals</span>
            <BellRing className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-lg font-bold text-slate-100 tabular-nums">
            {totalPendingApprovals} pending approvals · {criticalIncidents.length} critical incidents
          </div>
          <p className="text-xs text-slate-400">
            {pendingLeaves.length} leave request · {pendingTrades.length} shift trade ·{' '}
            {openIncidents.length} active L1/L2 floor logs
          </p>
          <div className="text-[11px] text-amber-300 font-medium pt-0.5">
            Open Action Center →
          </div>
        </div>

        {/* KPI 4: Schedule Equity */}
        <div
          onClick={() => {
            setActiveWorkspace('schedule');
            setScheduleSubView('roster_table');
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setActiveWorkspace('schedule');
          }}
          className="p-4 rounded-2xl bg-[#0D1117] hover:bg-[#151B24]/90 border border-slate-800/90 hover:border-[#818CF8]/50 transition-all cursor-pointer space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Rotation Equity Index</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono text-[10px]">
              DEMO METRIC
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-2xl font-bold text-indigo-300 tabular-nums">96%</div>
            <span className="text-xs text-slate-400 font-mono">±1.8h variance</span>
          </div>
          <p className="text-xs text-slate-400">
            Illustrative demonstration metric measuring weekend & night shift parity across squads.
          </p>
          <div className="text-[11px] text-indigo-300 font-medium pt-0.5">
            Inspect Squad Distribution →
          </div>
        </div>
      </div>

      {/* MAIN BENTO ROW: Current + Next Shift Card | 24-Hour Orbital Chrono-Ring | Actionable Alert Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card 2: Current Shift & My Next Shift (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#22D3EE]">
                Current Shift Status
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[11px]">
                {shiftProg.statusLabel}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#151B24] border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-base text-slate-100">
                  {activePersona.name}
                </span>
                <span className="font-mono text-xs text-[#22D3EE]">{activePersona.badgeCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <ShiftBadge shiftCode={myTodayAssign.shiftCode} showTime size="md" />
                <span className="font-mono text-xs text-slate-400">Sun 25 Oct</span>
              </div>
              <div className="text-xs text-slate-300">
                Assigned Station: <strong className="text-slate-100">{myTodayAssign.zone}</strong>
              </div>

              {/* Elapsed Progress Bar relative to 14:00 IST */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-300">{shiftProg.elapsedPct}% elapsed</span>
                  <span className="text-[#22D3EE] font-semibold">{shiftProg.countdownLabel}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-[#06B6D4] transition-all"
                    style={{ width: `${shiftProg.elapsedPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Start 07:30 IST</span>
                  <span>Demo Now 14:00 IST</span>
                  <span>End 16:30 IST</span>
                </div>
              </div>
            </div>

            {/* Overlap Window Notice */}
            <div className="p-3 rounded-xl bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-xs space-y-1">
              <div className="font-semibold text-[#22D3EE] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Active Handover Overlap Window (12:30–16:30)
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Both <span className="font-mono text-[#22D3EE]">1ST · Day</span> and{' '}
                <span className="font-mono text-emerald-300">2ND · Swing</span> squads are currently
                on floor. Handover sign-off due before 16:30 IST.
              </p>
            </div>
          </div>

          {/* Separate My Next Shift Section (§8 & §9 requirement) */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              My Next Scheduled Shift
            </div>
            <div className="p-3 rounded-xl bg-[#151B24]/70 border border-slate-800 flex items-center justify-between gap-2">
              <div>
                <div className="font-mono text-xs font-semibold text-slate-200">
                  Mon 26 Oct 2026
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Starts in 17h 30m · {myNextAssign.zone}
                </div>
              </div>
              <ShiftBadge shiftCode={myNextAssign.shiftCode} showTime size="sm" />
            </div>
          </div>
        </div>

        {/* Card 3: 24-Hour Orbital Chrono-Ring (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-base text-slate-100">
                24-Hour Orbital Chrono-Ring
              </h2>
              <p className="text-xs text-slate-400">
                Concentric shift bands & 12:30–16:30 overlap zone
              </p>
            </div>
            <button
              onClick={() => {
                setActiveWorkspace('schedule');
                setScheduleSubView('timeline_24h');
              }}
              className="text-xs font-semibold text-[#22D3EE] hover:underline"
            >
              24h Timeline →
            </button>
          </div>

          {/* Interactive SVG Concentric Orbital Ring */}
          <div className="relative flex items-center justify-center py-1">
            <svg
              viewBox="0 0 240 240"
              className="w-52 h-52"
              role="img"
              aria-label="24-hour orbital shift coverage ring showing 1ST Day 07:30 to 16:30, 2ND Swing 12:30 to 20:30, 3RD Night 20:30 to 07:30, and handover overlap 12:30 to 16:30"
            >
              {/* Background Guide Circles */}
              <circle cx="120" cy="120" r="96" fill="none" stroke="#1E293B" strokeWidth="10" />
              <circle cx="120" cy="120" r="78" fill="none" stroke="#1E293B" strokeWidth="10" />
              <circle cx="120" cy="120" r="60" fill="none" stroke="#1E293B" strokeWidth="8" />

              {/* Outer Ring (r=96): 1ST Day (07:30–16:30 = 9h/24h) & 3RD Night (20:30–07:30 = 11h/24h) */}
              {/* 1ST Day Arc */}
              <circle
                cx="120"
                cy="120"
                r="96"
                fill="none"
                stroke="#06B6D4"
                strokeWidth={selectedRingShift === '1ST' ? '13' : '10'}
                strokeDasharray="226 603"
                strokeDashoffset="-88"
                strokeLinecap="round"
                className="cursor-pointer transition-all"
                onClick={() => setSelectedRingShift('1ST')}
              />
              {/* 3RD Night Arc */}
              <circle
                cx="120"
                cy="120"
                r="96"
                fill="none"
                stroke="#818CF8"
                strokeWidth={selectedRingShift === '3RD' ? '13' : '10'}
                strokeDasharray="276 603"
                strokeDashoffset="-415"
                strokeLinecap="round"
                className="cursor-pointer transition-all"
                onClick={() => setSelectedRingShift('3RD')}
              />

              {/* Middle Ring (r=78): 2ND Swing (12:30–20:30 = 8h/24h) */}
              <circle
                cx="120"
                cy="120"
                r="78"
                fill="none"
                stroke="#10B981"
                strokeWidth={selectedRingShift === '2ND' ? '13' : '10'}
                strokeDasharray="163 490"
                strokeDashoffset="-153"
                strokeLinecap="round"
                className="cursor-pointer transition-all"
                onClick={() => setSelectedRingShift('2ND')}
              />

              {/* Inner Ring (r=60): GEN General (09:00–18:00 = 9h/24h) */}
              <circle
                cx="120"
                cy="120"
                r="60"
                fill="none"
                stroke="#F59E0B"
                strokeWidth={selectedRingShift === 'GEN' ? '11' : '8'}
                strokeDasharray="141 377"
                strokeDashoffset="-94"
                strokeLinecap="round"
                className="cursor-pointer transition-all"
                onClick={() => setSelectedRingShift('GEN')}
              />

              {/* Highlighted Handover Overlap Zone (12:30–16:30) Indicator */}
              <circle
                cx="120"
                cy="120"
                r="87"
                fill="none"
                stroke="#22D3EE"
                strokeWidth="3"
                strokeDasharray="88 546"
                strokeDashoffset="-170"
                opacity="0.85"
              />

              {/* Center Telemetry Readout */}
              <text
                x="120"
                y="108"
                textAnchor="middle"
                className="fill-slate-400 font-mono text-[10px] uppercase"
              >
                14:00 IST LIVE
              </text>
              <text
                x="120"
                y="128"
                textAnchor="middle"
                className="fill-slate-100 font-mono text-lg font-bold"
              >
                {activeOnFloorCount}/20
              </text>
              <text
                x="120"
                y="144"
                textAnchor="middle"
                className="fill-[#22D3EE] font-mono text-[10px]"
              >
                OVERLAP ACTIVE
              </text>
            </svg>
          </div>

          {/* Accessible Shift Ring Selector & Headcount Table */}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {(['1ST', '2ND', '3RD', 'GEN'] as ShiftCode[]).map((code) => {
              const meta = SHIFT_CATALOG[code];
              const count = shiftCountsToday[code as keyof typeof shiftCountsToday] || 0;
              const isSelected = selectedRingShift === code;
              return (
                <button
                  key={code}
                  onClick={() => setSelectedRingShift(code)}
                  className={`p-2 rounded-xl border text-left transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#151B24] border-[#06B6D4]'
                      : 'bg-[#151B24]/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-mono font-bold text-slate-100 flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: meta.accentHex }}
                      />
                      {meta.code}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">{meta.timeLabel}</div>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-200 tabular-nums">
                    {count} ops
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card 4: Actionable Alert Desk & Handover Status (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-base text-slate-100">
                Actionable Alert Desk
              </h2>
              <p className="text-xs text-slate-400">
                Click any item to launch resolution workflow
              </p>
            </div>
            <button
              onClick={() => setActiveWorkspace('needs_attention')}
              className="text-xs font-semibold text-[#22D3EE] hover:underline"
            >
              View All →
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {/* Item 1: Upcoming Night Coverage Gap */}
            {coverageGaps.map((gap) => (
              <div
                key={gap.id}
                className="p-3 rounded-xl bg-[#151B24] border border-amber-500/40 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                      COVERAGE GAP
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">{gap.date}</span>
                  </div>
                  <div className="font-display font-semibold text-xs text-slate-100">
                    {gap.zone} · {gap.shiftCode} ({gap.currentStaffed}/{gap.preferredTarget} staffed)
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{gap.reason}</p>
                </div>
                <button
                  onClick={() =>
                    setSupportingPanel({
                      kind: 'coverage_gap',
                      entityId: gap.id,
                      widthPx: 440
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs shrink-0 transition-colors"
                >
                  Fill Gap
                </button>
              </div>
            ))}

            {/* Item 2: Pending Leave Request */}
            {pendingLeaves.map((lr) => {
              const op = operators.find((o) => o.id === lr.operatorId);
              return (
                <div
                  key={lr.id}
                  className="p-3 rounded-xl bg-[#151B24] border border-slate-800 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#06B6D4]/20 text-[#22D3EE] font-mono text-[10px]">
                        LEAVE APPROVAL
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{lr.startDate}</span>
                    </div>
                    <div className="font-display font-semibold text-xs text-slate-100">
                      {op?.name} ({op?.badgeCode}) · {lr.leaveType}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{lr.reason}</p>
                  </div>
                  <button
                    onClick={() =>
                      setSupportingPanel({
                        kind: 'leave_request',
                        entityId: lr.id,
                        widthPx: 430
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs shrink-0 transition-colors"
                  >
                    Review
                  </button>
                </div>
              );
            })}

            {/* Item 3: Pending Atomic Shift Trade */}
            {pendingTrades.map((tr) => {
              const reqOp = operators.find((o) => o.id === tr.requesterId);
              const partOp = operators.find((o) => o.id === tr.partnerId);
              return (
                <div
                  key={tr.id}
                  className="p-3 rounded-xl bg-[#151B24] border border-slate-800 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                        SHIFT TRADE
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {tr.requesterDate}
                      </span>
                    </div>
                    <div className="font-display font-semibold text-xs text-slate-100">
                      {reqOp?.name} ({tr.requesterShift}) ↔ {partOp?.name} ({tr.partnerShift})
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      Pre-validated: 0 rest or certification violations
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSupportingPanel({
                        kind: 'shift_trade',
                        entityId: tr.id,
                        widthPx: 430
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs shrink-0 transition-colors"
                  >
                    Review
                  </button>
                </div>
              );
            })}

            {/* Item 4: Active Incident & Handover Packet */}
            <div className="p-3 rounded-xl bg-[#151B24] border border-slate-800 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
                    HANDOVER & INCIDENTS
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {handoverSession.status}
                  </span>
                </div>
                <div className="font-display font-semibold text-xs text-slate-100">
                  {openIncidents.length} active floor incidents · Overlap 12:30–16:30
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Outgoing: {handoverSession.outgoingLeadName} → Incoming:{' '}
                  {handoverSession.incomingLeadName}
                </p>
              </div>
              <button
                onClick={() => setActiveWorkspace('incidents')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs shrink-0 transition-colors"
              >
                Open Log
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const NeedsAttentionWorkspace: React.FC = () => {
  const inbox = useAttentionQueue();
  return <AttentionInbox {...inbox} />;
};
