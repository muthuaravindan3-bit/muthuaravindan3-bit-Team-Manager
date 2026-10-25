import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  UserCheck,
  Sparkles,
  FileCheck2,
  ArrowRight,
  GitCompare,
  Lock,
  Calendar,
  Award,
  Activity
} from 'lucide-react';
import { useShiftSync } from '../context/ShiftSyncContext';
import { ShiftBadge } from './ShiftBadge';
import { SHIFT_CATALOG, computeOperatorWeeklySummary } from '../utils/shiftSyncEngine';
import { ShiftCode } from '../data/shiftSyncTypes';
import { BOUNDARY_ASSIGNMENTS } from '../data/shiftSyncSeed';

export const SupportingPanel: React.FC = () => {
  const {
    supportingPanel,
    setSupportingPanel,
    closeSupportingPanel,
    operators,
    activeScope,
    scopes,
    coverageGaps,
    leaveRequests,
    shiftTrades,
    incidents,
    aiProposal,
    activeValidation,
    validationResults,
    updateAssignment,
    assignReplacementToGap,
    runScheduleValidation,
    publishScheduleScope,
    discardDraftChanges,
    approveLeaveRequest,
    declineLeaveRequest,
    approveAndExecuteShiftTrade,
    declineShiftTrade,
    toggleIncidentStep,
    updateIncidentOutcomeNote,
    resolveIncident,
    toggleIncidentCarryToHandover,
    applyAIProposalToDraft,
    discardAIProposal,
    activeConflict,
    resolveConcurrentConflict,
    activePersona,
    setIncidentsSubView
  } = useShiftSync();

  const [overrideRationale, setOverrideRationale] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [selectedDiffKeys, setSelectedDiffKeys] = useState<string[]>([]);
  const [isResizing, setIsResizing] = useState(false);

  // Sync AI proposal diff keys when opened
  useEffect(() => {
    if (aiProposal) {
      setSelectedDiffKeys(
        aiProposal.proposedChanges.map((c) => `${c.operatorId}__${c.date}`)
      );
    }
  }, [aiProposal]);

  // Handle Escape key to close supporting panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && supportingPanel.kind) {
        closeSupportingPanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [supportingPanel.kind, closeSupportingPanel]);

  // Desktop resize handler (380px - 520px)
  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const nextWidth = Math.max(380, Math.min(520, window.innerWidth - e.clientX));
      setSupportingPanel({ ...supportingPanel, widthPx: nextWidth });
    };
    const onMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing, supportingPanel, setSupportingPanel]);

  if (!supportingPanel.kind) return null;

  const canManageSchedule = activePersona.permissionRole !== 'Operator';

  return (
    <aside
      aria-label="Contextual Inspection and Action Panel"
      style={{ width: `${supportingPanel.widthPx}px` }}
      className="fixed xl:static top-14 bottom-0 right-0 z-[200] max-w-full bg-[#0D1117]/95 backdrop-blur-xl border-l border-slate-800/90 flex flex-col shadow-2xl transition-transform"
    >
      {/* Left resize handle on desktop */}
      <div
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize panel (380px–520px)"
        className="hidden xl:block absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#06B6D4]/50 transition-colors"
      />

      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-[#151B24]/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#06B6D4] shrink-0" />
          <h2 className="font-display text-sm font-semibold text-slate-100 truncate">
            {supportingPanel.kind === 'operator_dossier' && 'Operator Dossier Inspection'}
            {supportingPanel.kind === 'assignment_edit' && 'Shift Assignment Inspector'}
            {supportingPanel.kind === 'coverage_gap' && 'Coverage Gap · Replacement Finder'}
            {supportingPanel.kind === 'leave_request' && 'Leave Request & Coverage Review'}
            {supportingPanel.kind === 'shift_trade' && 'Atomic Shift Trade Review'}
            {supportingPanel.kind === 'incident_detail' && 'Incident Runbook & Mitigation'}
            {supportingPanel.kind === 'ai_proposal_review' && 'Autonomous Week Autopilot Proposal'}
            {supportingPanel.kind === 'publication_review' && 'Schedule Validation & Publication'}
            {supportingPanel.kind === 'conflict_resolution' && 'Concurrent Edit Conflict Resolution'}
          </h2>
        </div>
        <button
          onClick={closeSupportingPanel}
          aria-label="Close supporting panel"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {/* 1. OPERATOR DOSSIER */}
        {supportingPanel.kind === 'operator_dossier' && (() => {
          const op = operators.find((o) => o.id === supportingPanel.entityId) || operators[0];
          const weekly = computeOperatorWeeklySummary(
            op.id,
            activeScope.days,
            activeScope.assignments,
            BOUNDARY_ASSIGNMENTS
          );
          const todayAssign = activeScope.assignments.find(
            (a) => a.operatorId === op.id && a.date === '2026-10-25'
          );

          return (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#151B24] border border-slate-800/80 flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4]/40 flex items-center justify-center font-display font-bold text-[#22D3EE] shrink-0">
                  {op.avatarInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-bold text-base text-slate-100 truncate">
                      {op.name}
                    </h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[#22D3EE]">
                      {op.badgeCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {op.jobTitle} · <span className="text-slate-400">{op.permissionRole}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{op.zone} · {op.squad}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-[#151B24]/80 border border-slate-800/70">
                  <div className="text-[11px] text-slate-400">Scheduled</div>
                  <div className="font-mono text-base font-bold text-slate-100 tabular-nums mt-0.5">
                    {weekly.totalScheduledHours}h
                  </div>
                  <div className="text-[10px] text-slate-400">Cap: 48h/wk</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#151B24]/80 border border-slate-800/70">
                  <div className="text-[11px] text-slate-400">Paid / Break</div>
                  <div className="font-mono text-base font-bold text-[#34D399] tabular-nums mt-0.5">
                    {weekly.totalPaidHours}h
                  </div>
                  <div className="text-[10px] text-slate-400">{weekly.totalBreakHours}h unpaid brk</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#151B24]/80 border border-slate-800/70">
                  <div className="text-[11px] text-slate-400">Min Turnaround</div>
                  <div className="font-mono text-base font-bold text-[#22D3EE] tabular-nums mt-0.5">
                    {weekly.minRestHours === 99 ? '≥24h' : `${weekly.minRestHours}h`}
                  </div>
                  <div className="text-[10px] text-slate-400">Rule: ≥11h</div>
                </div>
              </div>

              {/* Active certifications */}
              <div className="p-3 rounded-xl bg-[#151B24]/60 border border-slate-800/70 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#06B6D4]" />
                  Active Operational Certifications
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {op.certifications.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 font-mono text-xs text-slate-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Readiness & Workload Indicator (explicitly labeled non-medical per §17) */}
              <div className="p-3 rounded-xl bg-[#151B24]/60 border border-slate-800/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#10B981]" />
                    Readiness & Workload Index
                  </span>
                  <span className="font-mono text-xs font-bold text-[#34D399] tabular-nums">
                    {op.readinessIndex}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#06B6D4] to-[#10B981]"
                    style={{ width: `${op.readinessIndex}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Simulated operational workload & turnaround indicator for scheduling demonstration only (non-medical data).
                </p>
              </div>

              {/* Weekly Roster Strip */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Assignments in {activeScope.label}
                </div>
                <div className="space-y-1.5">
                  {activeScope.days.map((d) => {
                    const cell = activeScope.assignments.find(
                      (a) => a.operatorId === op.id && a.date === d
                    );
                    return (
                      <div
                        key={d}
                        className="px-3 py-2 rounded-lg bg-[#151B24]/70 border border-slate-800/70 flex items-center justify-between"
                      >
                        <span className="font-mono text-xs text-slate-300 tabular-nums">{d}</span>
                        {cell ? (
                          <ShiftBadge
                            shiftCode={cell.shiftCode}
                            showTime
                            size="xs"
                            isDraftChanged={cell.isDraftChanged}
                            isLocked={cell.locked}
                          />
                        ) : (
                          <span className="text-xs text-slate-500">Unassigned</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {todayAssign && canManageSchedule && (
                <button
                  onClick={() =>
                    setSupportingPanel({
                      kind: 'assignment_edit',
                      entityId: op.id,
                      secondaryId: '2026-10-25',
                      widthPx: supportingPanel.widthPx
                    })
                  }
                  className="w-full py-2 px-3 rounded-lg bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 border border-[#06B6D4]/40 text-[#22D3EE] text-xs font-semibold transition-colors"
                >
                  Edit Sun 25 Oct Assignment
                </button>
              )}
            </div>
          );
        })()}

        {/* 2. ASSIGNMENT EDIT */}
        {supportingPanel.kind === 'assignment_edit' && (() => {
          const op = operators.find((o) => o.id === supportingPanel.entityId) || operators[0];
          const date = supportingPanel.secondaryId || '2026-10-25';
          const currentAssign = activeScope.assignments.find(
            (a) => a.operatorId === op.id && a.date === date
          );
          const allCodes: ShiftCode[] = ['1ST', '2ND', '3RD', 'GEN', 'WO', 'CO'];

          return (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-[#151B24] border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-slate-100">{op.name}</span>
                  <span className="font-mono text-xs text-[#22D3EE]">{op.badgeCode}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Target Date: <span className="font-mono text-slate-200">{date}</span> · {op.zone}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-xs text-slate-400">Current:</span>
                  {currentAssign && (
                    <ShiftBadge
                      shiftCode={currentAssign.shiftCode}
                      showTime
                      isDraftChanged={currentAssign.isDraftChanged}
                      isLocked={currentAssign.locked}
                    />
                  )}
                </div>
              </div>

              {currentAssign?.locked ? (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Shift Assignment Locked</div>
                    <p className="text-amber-300/80 mt-0.5">
                      Locked shifts are protected from automated autopilot swaps and bulk edits.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Select New Shift Preset ({activeScope.label})
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {allCodes.map((code) => {
                    const meta = SHIFT_CATALOG[code];
                    const isSelected = currentAssign?.shiftCode === code;
                    return (
                      <button
                        key={code}
                        disabled={!canManageSchedule}
                        onClick={() => updateAssignment(activeScope.id, op.id, date, code)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#06B6D4]/15 border-[#06B6D4] ring-1 ring-[#06B6D4]'
                            : 'bg-[#151B24]/70 border-slate-800 hover:border-slate-700'
                        } ${!canManageSchedule ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div>
                          <div className="font-display font-semibold text-slate-100 text-xs flex items-center gap-2">
                            <ShiftBadge shiftCode={code} size="xs" />
                            <span>{meta.label}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">{meta.description}</div>
                        </div>
                        <div className="text-right font-mono text-xs text-slate-300 tabular-nums">
                          <div>{meta.timeLabel}</div>
                          <div className="text-[10px] text-slate-400">{meta.scheduledHours}h</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() =>
                    setSupportingPanel({
                      kind: 'publication_review',
                      entityId: activeScope.id,
                      widthPx: supportingPanel.widthPx
                    })
                  }
                  className="flex-1 py-2 px-3 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Validate & Review Publication
                </button>
              </div>
            </div>
          );
        })()}

        {/* 3. COVERAGE GAP REPLACEMENT FINDER (Journey 1 & Journey 2) */}
        {supportingPanel.kind === 'coverage_gap' && (() => {
          const gap =
            coverageGaps.find((g) => g.id === supportingPanel.entityId) || coverageGaps[0];
          if (!gap) {
            return (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="font-display font-semibold text-slate-100">
                  All Coverage Gaps Resolved
                </div>
                <p className="text-xs text-slate-400">
                  Every shift and zone meets preferred staffing targets.
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#151B24] border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {gap.severity === 'blocking' ? 'BLOCKING UNDERSTAFFING' : 'PREFERRED TARGET OPENING'}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{gap.id}</span>
                </div>
                <div className="font-display font-bold text-slate-100 text-sm">
                  {gap.zone} · {gap.roleRequired}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="font-mono">{gap.date}</span>
                  <span>·</span>
                  <ShiftBadge shiftCode={gap.shiftCode} showTime size="xs" />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{gap.reason}</p>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Current</div>
                    <div className="font-bold text-amber-300">{gap.currentStaffed}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Hard Min</div>
                    <div className="font-bold text-slate-200">{gap.hardMinimum}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Preferred</div>
                    <div className="font-bold text-[#22D3EE]">{gap.preferredTarget}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Replacement Candidate Comparison</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Req Cert: {gap.requiredCert}
                  </span>
                </div>

                {gap.candidates.map((cand) => {
                  const op = operators.find((o) => o.id === cand.operatorId);
                  if (!op) return null;
                  const isEligible = !cand.ineligibleReason;
                  const isAssigned = gap.assignedReplacementId === op.id;

                  return (
                    <div
                      key={cand.operatorId}
                      className={`p-3 rounded-xl border space-y-2.5 transition-all ${
                        isAssigned
                          ? 'bg-emerald-950/30 border-emerald-500/60'
                          : isEligible
                          ? 'bg-[#151B24] border-slate-800 hover:border-[#06B6D4]/60'
                          : 'bg-[#151B24]/40 border-rose-900/40 opacity-85'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-display font-bold text-slate-100 text-xs flex items-center gap-1.5">
                            <span>{op.name}</span>
                            <span className="font-mono text-[11px] text-[#22D3EE]">
                              {op.badgeCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {op.jobTitle} · {cand.availabilityStatus}
                          </div>
                        </div>
                        {isEligible ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px]">
                            ELIGIBLE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/40 text-rose-300 font-mono text-[10px]">
                            INELIGIBLE
                          </span>
                        )}
                      </div>

                      {/* Candidate telemetry metrics */}
                      <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800/70">
                        <div>
                          <div className="text-[10px] text-slate-400">Rest Prior</div>
                          <div
                            className={
                              cand.restHoursBefore < 11 ? 'text-rose-400 font-bold' : 'text-emerald-300'
                            }
                          >
                            {cand.restHoursBefore}h
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Proj Week</div>
                          <div
                            className={
                              cand.projectedWeeklyHours > 48 ? 'text-amber-300' : 'text-slate-200'
                            }
                          >
                            {cand.projectedWeeklyHours}h
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">OT Impact</div>
                          <div className="text-slate-200">+{cand.overtimeImpactHours}h</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Equity Δ</div>
                          <div className="text-[#22D3EE]">{cand.fairnessDelta}</div>
                        </div>
                      </div>

                      {cand.ineligibleReason ? (
                        <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>{cand.ineligibleReason}</span>
                        </div>
                      ) : (
                        <button
                          disabled={!canManageSchedule || isAssigned}
                          onClick={() => assignReplacementToGap(gap.id, op.id)}
                          className="w-full py-2 px-3 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] disabled:bg-emerald-700 disabled:text-emerald-100 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          {isAssigned
                            ? 'Replacement Staged in Draft'
                            : `Stage ${op.name} & Open Validation`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 4. LEAVE REQUEST REVIEW */}
        {supportingPanel.kind === 'leave_request' && (() => {
          const req =
            leaveRequests.find((r) => r.id === supportingPanel.entityId) || leaveRequests[0];
          if (!req) return null;
          const op = operators.find((o) => o.id === req.operatorId);

          return (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#151B24] border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#22D3EE]">{req.id}</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/40">
                    {req.status}
                  </span>
                </div>
                <div className="font-display font-bold text-slate-100 text-base">
                  {op?.name} ({op?.badgeCode})
                </div>
                <div className="text-xs text-slate-300">
                  {req.leaveType} · <span className="font-mono">{req.startDate}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Impacted Shift:</span>
                  <ShiftBadge shiftCode={req.affectedShift} showTime size="xs" />
                </div>
                <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  “{req.reason}”
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#151B24]/70 border border-slate-800 space-y-1.5">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#06B6D4]" />
                  Coverage & Turnaround Pre-Check
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {req.coverageImpactSummary}
                </p>
                <p className="text-[11px] text-slate-400">
                  Approving this request transitions it to{' '}
                  <span className="font-mono text-amber-300">
                    Approved — schedule update pending
                  </span>{' '}
                  and opens replacement candidate assignment before publishing.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="leave-review-note"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Supervisor Review Note (Required to Decline)
                </label>
                <textarea
                  id="leave-review-note"
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Add coverage routing note or rationale..."
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              {req.status === 'Pending Approval' && canManageSchedule && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => approveLeaveRequest(req.id, reviewNote)}
                    className="py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#059669] text-slate-950 font-semibold text-xs transition-colors"
                  >
                    Approve & Plan Coverage
                  </button>
                  <button
                    onClick={() => declineLeaveRequest(req.id, reviewNote)}
                    className="py-2 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-semibold text-xs transition-colors"
                  >
                    Decline Request
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* 5. ATOMIC SHIFT TRADE REVIEW */}
        {supportingPanel.kind === 'shift_trade' && (() => {
          const trade =
            shiftTrades.find((t) => t.id === supportingPanel.entityId) || shiftTrades[0];
          if (!trade) return null;
          const reqOp = operators.find((o) => o.id === trade.requesterId);
          const partOp = operators.find((o) => o.id === trade.partnerId);

          return (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#151B24] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#22D3EE]">{trade.id}</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#06B6D4]/15 text-[#22D3EE] border border-[#06B6D4]/40">
                    {trade.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Requester</div>
                    <div className="font-semibold text-slate-100 text-xs mt-0.5">
                      {reqOp?.name}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">{trade.requesterDate}</div>
                    <div className="mt-1">
                      <ShiftBadge shiftCode={trade.requesterShift} size="xs" />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Counterparty</div>
                    <div className="font-semibold text-slate-100 text-xs mt-0.5">
                      {partOp?.name}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">{trade.partnerDate}</div>
                    <div className="mt-1">
                      <ShiftBadge shiftCode={trade.partnerShift} size="xs" />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300">“{trade.reason}”</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Atomic Bilateral Validation Passed
                </div>
                <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                  {trade.validationNotes.map((n, idx) => (
                    <li key={idx}>{n}</li>
                  ))}
                </ul>
              </div>

              {trade.status === 'Supervisor Review' && canManageSchedule && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => approveAndExecuteShiftTrade(trade.id, reviewNote)}
                    className="py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#059669] text-slate-950 font-semibold text-xs transition-colors"
                  >
                    Approve & Apply Atomically
                  </button>
                  <button
                    onClick={() => declineShiftTrade(trade.id, reviewNote || 'Supervisor declined')}
                    className="py-2 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-semibold text-xs transition-colors"
                  >
                    Decline Swap
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* 6. INCIDENT DETAIL & RUNBOOK */}
        {supportingPanel.kind === 'incident_detail' && (() => {
          const inc =
            incidents.find((i) => i.id === supportingPanel.entityId) || incidents[0];
          if (!inc) return null;

          return (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#151B24] border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-amber-300">{inc.id}</span>
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-900 border border-slate-700 text-slate-200">
                    {inc.severity} · {inc.status}
                  </span>
                </div>
                <h3 className="font-display font-bold text-slate-100 text-sm">{inc.title}</h3>
                <div className="text-xs text-slate-400">{inc.zone}</div>
                <p className="text-xs text-slate-300 leading-relaxed">{inc.summary}</p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-200">
                  Mitigation Runbook Checklist
                </div>
                {inc.checklist.map((step) => (
                  <label
                    key={step.id}
                    className="p-2.5 rounded-lg bg-[#151B24]/80 border border-slate-800 flex items-start gap-2.5 cursor-pointer hover:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={step.completed}
                      onChange={() => toggleIncidentStep(inc.id, step.id)}
                      className="mt-0.5 rounded border-slate-700 text-[#06B6D4] focus:ring-[#06B6D4]"
                    />
                    <div className="flex-1 text-xs">
                      <div className={step.completed ? 'line-through text-slate-400' : 'text-slate-200'}>
                        {step.label}
                      </div>
                      {step.completedAtIso && (
                        <div className="font-mono text-[10px] text-emerald-400 mt-0.5">
                          Completed {step.completedAtIso}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="inc-outcome-note"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Mitigation Outcome & Handover Note
                </label>
                <textarea
                  id="inc-outcome-note"
                  rows={3}
                  value={inc.outcomeNote}
                  onChange={(e) => updateIncidentOutcomeNote(inc.id, e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#151B24]/60 border border-slate-800 cursor-pointer">
                <span className="text-xs text-slate-200">Include in Shift Handover Log</span>
                <input
                  type="checkbox"
                  checked={inc.carryToHandover}
                  onChange={() => toggleIncidentCarryToHandover(inc.id)}
                  className="rounded border-slate-700 text-[#06B6D4]"
                />
              </label>

              {inc.status !== 'Resolved' ? (
                <button
                  onClick={() => resolveIncident(inc.id)}
                  className="w-full py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#059669] text-slate-950 font-semibold text-xs transition-colors"
                >
                  Mark Incident Resolved
                </button>
              ) : (
                <div className="space-y-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Incident Resolved & Staged to Handover Log
                  </div>
                  <button
                    onClick={() => {
                      setIncidentsSubView('handover');
                      closeSupportingPanel();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-[#06B6D4] hover:bg-[#22D3EE] text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Proceed to Shift Handover Sign-Off</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* 7. AI AUTOPILOT PROPOSAL REVIEW (Journey 3) */}
        {supportingPanel.kind === 'ai_proposal_review' && aiProposal && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#151B24] border border-[#06B6D4]/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#06B6D4]/20 text-[#22D3EE] border border-[#06B6D4]/40">
                  Isolated Proposal State
                </span>
                <span className="font-mono text-xs text-slate-400">26 Oct–1 Nov 2026</span>
              </div>
              <h3 className="font-display font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#22D3EE]" />
                {aiProposal.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{aiProposal.summary}</p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center font-mono text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">Openings Left</div>
                  <div className="font-bold text-emerald-400">{aiProposal.HardGapsRemaining}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Turnaround Viol.</div>
                  <div className="font-bold text-emerald-400">{aiProposal.turnaroundViolations}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Equity Score</div>
                  <div className="font-bold text-[#22D3EE]">{aiProposal.fairnessScorePct}%</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>Proposed Assignment Diffs ({aiProposal.proposedChanges.length})</span>
                <span className="text-[11px] text-slate-400">Select to apply</span>
              </div>
              {aiProposal.proposedChanges.map((ch) => {
                const key = `${ch.operatorId}__${ch.date}`;
                const checked = selectedDiffKeys.includes(key);
                return (
                  <label
                    key={key}
                    className={`p-3 rounded-xl border block cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#151B24] border-[#06B6D4]/60'
                        : 'bg-[#151B24]/40 border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedDiffKeys((prev) =>
                            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                          )
                        }
                        className="mt-1 rounded border-slate-700 text-[#06B6D4]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-slate-100 text-xs">
                            {ch.operatorName}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">{ch.date}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{ch.zone}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <ShiftBadge shiftCode={ch.fromShift} size="xs" />
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <ShiftBadge shiftCode={ch.toShift} showTime size="xs" />
                        </div>
                        <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                          {ch.rationale}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => applyAIProposalToDraft(selectedDiffKeys)}
                disabled={selectedDiffKeys.length === 0}
                className="py-2 px-3 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] disabled:opacity-40 text-slate-950 font-semibold text-xs transition-colors"
              >
                Apply {selectedDiffKeys.length} to Draft
              </button>
              <button
                onClick={discardAIProposal}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
              >
                Discard Proposal
              </button>
            </div>
          </div>
        )}

        {/* 8. PUBLICATION REVIEW & VALIDATION GATE */}
        {supportingPanel.kind === 'publication_review' && (() => {
          const targetScope = scopes[supportingPanel.entityId || activeScope.id] || activeScope;
          const val = validationResults[targetScope.id] || activeValidation;
          const changedCells = targetScope.assignments.filter((a) => a.isDraftChanged);

          return (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#151B24] border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#22D3EE]">{targetScope.version}</span>
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-900 border border-slate-700 text-slate-200">
                    State: {targetScope.status}
                  </span>
                </div>
                <div className="font-display font-bold text-slate-100 text-sm">
                  {targetScope.label}
                </div>
                <div className="text-xs text-slate-400">
                  Unpublished cell changes:{' '}
                  <span className="font-mono font-bold text-slate-200">{changedCells.length}</span>
                </div>
              </div>

              {/* Validation Summary */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`p-3 rounded-xl border ${
                    val.blockingCount === 0
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="text-[11px] uppercase font-mono">Blocking Errors</div>
                  <div className="font-mono text-xl font-bold tabular-nums mt-0.5">
                    {val.blockingCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl border bg-amber-950/20 border-amber-500/30 text-amber-300">
                  <div className="text-[11px] uppercase font-mono">Advisory Warnings</div>
                  <div className="font-mono text-xl font-bold tabular-nums mt-0.5">
                    {val.advisoryCount}
                  </div>
                </div>
              </div>

              {/* List issues if any */}
              {val.issues.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">
                    Validation Findings ({val.issues.length})
                  </div>
                  {val.issues.map((iss) => (
                    <div
                      key={iss.id}
                      className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                        iss.severity === 'blocking'
                          ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                          : 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>{iss.title}</span>
                        <span className="font-mono text-[10px] uppercase">{iss.severity}</span>
                      </div>
                      <p className="text-[11px] opacity-90">{iss.description}</p>
                      <p className="text-[11px] text-[#22D3EE]">Fix: {iss.remediation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Zero blocking or advisory issues. All 11h turnaround and certification guardrails pass.
                  </span>
                </div>
              )}

              {val.blockingCount > 0 && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="override-rationale"
                    className="block text-xs font-semibold text-rose-300"
                  >
                    Supervisor Emergency Override Rationale (Required if publishing with blocking issues)
                  </label>
                  <textarea
                    id="override-rationale"
                    rows={2}
                    value={overrideRationale}
                    onChange={(e) => setOverrideRationale(e.target.value)}
                    placeholder="Document operational necessity for audit log..."
                    className="w-full rounded-lg bg-slate-950 border border-rose-500/40 px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => runScheduleValidation(targetScope.id)}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition-colors"
                >
                  1. Run Schedule Validation Check
                </button>
                <button
                  disabled={!canManageSchedule}
                  onClick={() => publishScheduleScope(targetScope.id, overrideRationale)}
                  className="w-full py-2.5 px-3 rounded-lg bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-slate-950 font-bold text-xs transition-colors"
                >
                  2. Publish Versioned Schedule & Notify Operators
                </button>
                {changedCells.length > 0 && (
                  <button
                    onClick={() => discardDraftChanges(targetScope.id)}
                    className="w-full py-1.5 px-3 rounded-lg text-rose-300 hover:bg-rose-950/30 text-xs transition-colors"
                  >
                    Discard Draft Changes
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* 9. CONCURRENT CONFLICT RESOLUTION */}
        {supportingPanel.kind === 'conflict_resolution' && activeConflict && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/50 space-y-2">
              <div className="flex items-center gap-2 text-rose-300 font-display font-bold text-sm">
                <GitCompare className="w-4 h-4" />
                Concurrent Schedule Modification Detected
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                While you were editing <span className="font-mono">{activeConflict.localBaseVersion}</span>,{' '}
                <strong className="text-slate-100">{activeConflict.remoteActor}</strong> published{' '}
                <span className="font-mono text-[#22D3EE]">{activeConflict.remoteVersion}</span>.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                Conflicting Roster Cells ({activeConflict.conflictingCells.length})
              </div>
              {activeConflict.conflictingCells.map((c) => (
                <div
                  key={`${c.operatorId}-${c.date}`}
                  className="p-3 rounded-xl bg-[#151B24] border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-100">{c.operatorName}</span>
                    <span className="font-mono text-slate-400">{c.date}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 mb-1">Your Draft Edit</div>
                      <ShiftBadge shiftCode={c.yourShift} showTime size="xs" />
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-[#06B6D4]/40">
                      <div className="text-[10px] text-[#22D3EE] mb-1">Remote Published</div>
                      <ShiftBadge shiftCode={c.theirShift} showTime size="xs" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => resolveConcurrentConflict('keep_mine_revalidate')}
                className="w-full py-2 px-3 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs transition-colors"
              >
                Re-apply My Changes on Top & Re-validate
              </button>
              <button
                onClick={() => resolveConcurrentConflict('reload_theirs')}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
              >
                Accept Remote Published Version ({activeConflict.remoteVersion})
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
