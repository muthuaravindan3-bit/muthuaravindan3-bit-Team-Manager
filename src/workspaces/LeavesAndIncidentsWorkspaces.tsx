import React, { useState } from 'react';
import {
  Calendar,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ShieldCheck,
  Clock,
  FileSignature,
  KeyRound,
  Activity,
  Lock
} from 'lucide-react';
import { useShiftSync } from '../context/ShiftSyncContext';
import { ShiftBadge } from '../components/ShiftBadge';
import { LeavesSubView, IncidentsSubView, LeaveRequest, IncidentRecord } from '../data/shiftSyncTypes';

export const LeavesAndTradesWorkspace: React.FC = () => {
  const {
    leavesSubView,
    setLeavesSubView,
    leaveRequests,
    shiftTrades,
    operators,
    scopes,
    activePersona,
    setSupportingPanel,
    approveLeaveRequest,
    declineLeaveRequest,
    submitNewLeaveRequest,
    approveAndExecuteShiftTrade,
    declineShiftTrade,
    proposeShiftTrade,
    setActiveWorkspace,
    setSelectedDate,
    setActiveScopeId
  } = useShiftSync();

  const [newLeaveType, setNewLeaveType] = useState<LeaveRequest['leaveType']>('Annual Leave');
  const [newLeaveDate, setNewLeaveDate] = useState('2026-10-29');
  const [newLeaveReason, setNewLeaveReason] = useState('');

  const [tradePartnerId, setTradePartnerId] = useState('op-james');
  const [tradeDate, setTradeDate] = useState('2026-10-29');
  const [tradeReason, setTradeReason] = useState('');

  const canApprove = activePersona.permissionRole !== 'Operator';

  const handleCreateLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaveReason.trim()) return;
    submitNewLeaveRequest({
      operatorId: activePersona.operatorId,
      leaveType: newLeaveType,
      startDate: newLeaveDate,
      endDate: newLeaveDate,
      reason: newLeaveReason.trim()
    });
    setNewLeaveReason('');
  };

  const handleCreateTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeReason.trim()) return;
    proposeShiftTrade({
      requesterId: activePersona.operatorId,
      requesterDate: tradeDate,
      partnerId: tradePartnerId,
      partnerDate: tradeDate,
      reason: tradeReason.trim()
    });
    setTradeReason('');
  };

  return (
    <div className="space-y-4">
      {/* Header & Sub-View Switcher */}
      <div className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            Leaves & Atomic Shift Trades
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Leave approvals automatically stage roster updates and replacement planning before publication. Shift trades execute atomically.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-[#151B24] p-1 border border-slate-800">
          {(
            [
              { id: 'requests', label: `Leave Requests (${leaveRequests.length})` },
              { id: 'shift_trades', label: `Shift Trades (${shiftTrades.length})` },
              { id: 'team_calendar', label: 'Team Absence Calendar' },
              { id: 'my_requests', label: 'Submit / My Requests' }
            ] as { id: LeavesSubView; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLeavesSubView(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                leavesSubView === tab.id
                  ? 'bg-slate-800 text-[#22D3EE] border border-[#06B6D4]/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: LEAVE REQUESTS */}
      {leavesSubView === 'requests' && (
        <div className="space-y-3">
          {leaveRequests.map((lr) => {
            const op = operators.find((o) => o.id === lr.operatorId);
            const repOp = lr.replacementOperatorId
              ? operators.find((o) => o.id === lr.replacementOperatorId)
              : null;

            return (
              <div
                key={lr.id}
                className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-[#22D3EE]">{lr.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                        lr.status === 'Approved & Published'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : lr.status === 'Approved — schedule update pending'
                          ? 'bg-[#06B6D4]/20 border-[#06B6D4]/50 text-[#22D3EE]'
                          : lr.status === 'Pending Approval'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {lr.status}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      Date: <strong className="text-slate-200">{lr.startDate}</strong>
                    </span>
                    <ShiftBadge shiftCode={lr.affectedShift} showTime size="xs" />
                  </div>

                  <div className="font-display font-bold text-base text-slate-100">
                    {op?.name} ({op?.badgeCode}) · {lr.leaveType}
                  </div>
                  <p className="text-xs text-slate-300">“{lr.reason}”</p>
                  <p className="text-xs text-slate-400">{lr.coverageImpactSummary}</p>

                  {repOp && (
                    <div className="text-xs text-emerald-300 font-mono">
                      Assigned Replacement: {repOp.name} ({repOp.badgeCode})
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {lr.status === 'Pending Approval' && canApprove && (
                    <>
                      <button
                        onClick={() =>
                          approveLeaveRequest(
                            lr.id,
                            'Approved by Shift Lead; staging replacement coverage.'
                          )
                        }
                        className="px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-slate-950 font-semibold text-xs transition-colors"
                      >
                        Approve & Plan Replacement
                      </button>
                      <button
                        onClick={() =>
                          setSupportingPanel({
                            kind: 'leave_request',
                            entityId: lr.id,
                            widthPx: 430
                          })
                        }
                        className="px-3.5 py-2 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors"
                      >
                        Inspect / Decline
                      </button>
                    </>
                  )}

                  {lr.status === 'Approved — schedule update pending' && (
                    <button
                      onClick={() =>
                        setSupportingPanel({
                          kind: 'coverage_gap',
                          entityId: `GAP-LR-${lr.id}`,
                          widthPx: 440
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs transition-colors"
                    >
                      Select Replacement & Publish Roster
                    </button>
                  )}

                  {lr.status === 'Approved & Published' && (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Schedule Published</span>
                      </span>
                      <button
                        onClick={() => {
                          const targetScope = Object.values(scopes).find((s) =>
                            s.days.includes(lr.startDate)
                          );
                          if (targetScope) setActiveScopeId(targetScope.id);
                          setSelectedDate(lr.startDate);
                          setActiveWorkspace('schedule');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 transition-colors"
                      >
                        View on Roster
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: ATOMIC SHIFT TRADES */}
      {leavesSubView === 'shift_trades' && (
        <div className="space-y-3">
          {shiftTrades.map((tr) => {
            const reqOp = operators.find((o) => o.id === tr.requesterId);
            const partOp = operators.find((o) => o.id === tr.partnerId);

            return (
              <div
                key={tr.id}
                className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#22D3EE]">{tr.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                        tr.status === 'Approved & Applied'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : tr.status === 'Supervisor Review'
                          ? 'bg-[#06B6D4]/20 border-[#06B6D4]/40 text-[#22D3EE]'
                          : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {tr.status}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      Swap Date: <strong className="text-slate-200">{tr.requesterDate}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="p-2.5 rounded-xl bg-[#151B24] border border-slate-800 flex items-center gap-2">
                      <span className="font-display font-bold text-xs text-slate-100">
                        {reqOp?.name} ({reqOp?.badgeCode})
                      </span>
                      <ShiftBadge shiftCode={tr.requesterShift} showTime size="xs" />
                    </div>
                    <ArrowLeftRight className="w-4 h-4 text-[#22D3EE]" />
                    <div className="p-2.5 rounded-xl bg-[#151B24] border border-slate-800 flex items-center gap-2">
                      <span className="font-display font-bold text-xs text-slate-100">
                        {partOp?.name} ({partOp?.badgeCode})
                      </span>
                      <ShiftBadge shiftCode={tr.partnerShift} showTime size="xs" />
                    </div>
                  </div>

                  <p className="text-xs text-slate-300">“{tr.reason}”</p>
                  <div className="flex flex-wrap gap-2">
                    {tr.validationNotes.map((n, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300"
                      >
                        ✓ {n}
                      </span>
                    ))}
                  </div>
                </div>

                {tr.status === 'Supervisor Review' && canApprove && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approveAndExecuteShiftTrade(tr.id)}
                      className="px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-slate-950 font-semibold text-xs transition-colors"
                    >
                      Approve & Apply Atomically
                    </button>
                    <button
                      onClick={() => declineShiftTrade(tr.id, 'Supervisor declined trade')}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-semibold text-xs transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: TEAM ABSENCE CALENDAR */}
      {leavesSubView === 'team_calendar' && (
        <div className="rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 space-y-4">
          <h2 className="font-display font-bold text-base text-slate-100">
            Team Off-Roster & Leave Calendar · 26 Oct–1 Nov 2026
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {scopes['scope-2026-10-26'].days.map((d, idx) => {
              const offAssignments = scopes['scope-2026-10-26'].assignments.filter(
                (a) => a.date === d && ['WO', 'CO'].includes(a.shiftCode)
              );
              const dayLeaves = leaveRequests.filter((l) => l.startDate === d);

              return (
                <div
                  key={d}
                  className="p-3 rounded-xl bg-[#151B24] border border-slate-800 space-y-2"
                >
                  <div className="font-display font-bold text-xs text-slate-100 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>{scopes['scope-2026-10-26'].dayLabels[idx]}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {offAssignments.length} off
                    </span>
                  </div>
                  {dayLeaves.map((lr) => {
                    const op = operators.find((o) => o.id === lr.operatorId);
                    return (
                      <div
                        key={lr.id}
                        className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-200"
                      >
                        <div className="font-semibold">{op?.name}</div>
                        <div className="font-mono text-[10px]">{lr.status}</div>
                      </div>
                    );
                  })}
                  <div className="space-y-1">
                    {offAssignments.map((a) => {
                      const op = operators.find((o) => o.id === a.operatorId);
                      return (
                        <div
                          key={a.operatorId}
                          className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-900/70 px-2 py-1 rounded"
                        >
                          <span className="truncate">{op?.name.split(' ')[0]}</span>
                          <ShiftBadge shiftCode={a.shiftCode} size="xs" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SUBMIT LEAVE OR PROPOSE SHIFT TRADE */}
      {leavesSubView === 'my_requests' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Submit New Leave Form */}
          <form
            onSubmit={handleCreateLeave}
            className="p-5 rounded-2xl bg-[#0D1117] border border-slate-800/90 space-y-4"
          >
            <h2 className="font-display font-bold text-base text-slate-100">
              Submit New Leave or Compensatory Off Request
            </h2>
            <div className="space-y-1.5">
              <label htmlFor="leave-type-select" className="block text-xs font-semibold text-slate-300">
                Leave Category
              </label>
              <select
                id="leave-type-select"
                value={newLeaveType}
                onChange={(e) => setNewLeaveType(e.target.value as LeaveRequest['leaveType'])}
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
              >
                <option value="Annual Leave">Annual Leave</option>
                <option value="Medical / Personal">Medical / Personal</option>
                <option value="Compensatory Off Request">Compensatory Off Request (CO)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="leave-date-input" className="block text-xs font-semibold text-slate-300">
                Target Shift Date
              </label>
              <input
                id="leave-date-input"
                type="date"
                value={newLeaveDate}
                onChange={(e) => setNewLeaveDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs font-mono text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="leave-reason-input" className="block text-xs font-semibold text-slate-300">
                Operational Handover & Reason
              </label>
              <textarea
                id="leave-reason-input"
                rows={3}
                required
                value={newLeaveReason}
                onChange={(e) => setNewLeaveReason(e.target.value)}
                placeholder="State reason and any station handover notes..."
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs transition-colors"
            >
              Submit Leave Request for Approval
            </button>
          </form>

          {/* Propose Atomic Shift Trade Form */}
          <form
            onSubmit={handleCreateTrade}
            className="p-5 rounded-2xl bg-[#0D1117] border border-slate-800/90 space-y-4"
          >
            <h2 className="font-display font-bold text-base text-slate-100">
              Propose Bilateral Atomic Shift Trade
            </h2>
            <div className="space-y-1.5">
              <label htmlFor="trade-partner-select" className="block text-xs font-semibold text-slate-300">
                Counterparty Operator (Matching Certifications)
              </label>
              <select
                id="trade-partner-select"
                value={tradePartnerId}
                onChange={(e) => setTradePartnerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
              >
                {operators
                  .filter((o) => o.id !== activePersona.operatorId)
                  .map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name} ({op.badgeCode}) · {op.zone}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="trade-date-input" className="block text-xs font-semibold text-slate-300">
                Target Swap Date
              </label>
              <input
                id="trade-date-input"
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs font-mono text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="trade-reason-input" className="block text-xs font-semibold text-slate-300">
                Swap Rationale
              </label>
              <textarea
                id="trade-reason-input"
                rows={3}
                required
                value={tradeReason}
                onChange={(e) => setTradeReason(e.target.value)}
                placeholder="Mutual swap reason (pre-checked against >=11h turnaround rule)..."
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-slate-950 font-semibold text-xs transition-colors"
            >
              Propose Atomic Shift Trade
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export const IncidentsAndHandoverWorkspace: React.FC = () => {
  const {
    incidentsSubView,
    setIncidentsSubView,
    incidents,
    handoverSession,
    operators,
    toggleIncidentStep,
    updateIncidentOutcomeNote,
    resolveIncident,
    toggleIncidentCarryToHandover,
    createIncident,
    updateHandoverSession,
    sealShiftHandover,
    setSupportingPanel
  } = useShiftSync();

  const [newIncTitle, setNewIncTitle] = useState('');
  const [newIncSeverity, setNewIncSeverity] = useState<IncidentRecord['severity']>('L2 · Elevated');
  const [newIncZone, setNewIncZone] = useState('Sector A · Core Ops');
  const [newIncSummary, setNewIncSummary] = useState('');
  const [incomingAckName, setIncomingAckName] = useState(handoverSession.incomingLeadName);

  const handleLogIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncTitle.trim()) return;
    createIncident({
      title: newIncTitle.trim(),
      severity: newIncSeverity,
      zone: newIncZone,
      summary: newIncSummary.trim() || 'Logged during active shift monitoring.'
    });
    setNewIncTitle('');
    setNewIncSummary('');
  };

  const carriedIncidents = incidents.filter((i) => i.carryToHandover);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            Incidents & Shift Handover Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Track floor anomalies, execute mitigation runbooks, and seal the 12:30–16:30 Day-to-Swing shift handover packet.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-[#151B24] p-1 border border-slate-800">
          {(
            [
              { id: 'incidents', label: `Floor Incidents (${incidents.length})` },
              { id: 'handover', label: `Shift Handover Sign-Off (${handoverSession.status})` }
            ] as { id: IncidentsSubView; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setIncidentsSubView(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                incidentsSubView === tab.id
                  ? 'bg-slate-800 text-[#22D3EE] border border-[#06B6D4]/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUBVIEW 1: INCIDENTS */}
      {incidentsSubView === 'incidents' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 space-y-3">
            {incidents.map((inc) => {
              const owner = operators.find((o) => o.id === inc.ownerOperatorId);
              return (
                <div
                  key={inc.id}
                  className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-amber-300 font-bold">{inc.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                          inc.status === 'Resolved'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        {inc.severity} · {inc.status}
                      </span>
                      <span className="text-xs text-slate-400">{inc.zone}</span>
                    </div>
                    <span className="font-mono text-xs text-slate-400">
                      Owner: {owner?.name} ({owner?.badgeCode})
                    </span>
                  </div>

                  <h2 className="font-display font-bold text-base text-slate-100">{inc.title}</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">{inc.summary}</p>

                  {/* Interactive Runbook Steps */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-semibold text-slate-300">
                      Mitigation Runbook Steps:
                    </div>
                    {inc.checklist.map((step) => (
                      <label
                        key={step.id}
                        className="p-2.5 rounded-xl bg-[#151B24] border border-slate-800 flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 text-xs">
                          <input
                            type="checkbox"
                            checked={step.completed}
                            onChange={() => toggleIncidentStep(inc.id, step.id)}
                            className="rounded border-slate-700 text-[#06B6D4]"
                          />
                          <span
                            className={
                              step.completed ? 'line-through text-slate-400' : 'text-slate-100'
                            }
                          >
                            {step.label}
                          </span>
                        </div>
                        {step.completedAtIso && (
                          <span className="font-mono text-[10px] text-emerald-400">
                            {step.completedAtIso}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>

                  {/* Outcome note & actions */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inc.carryToHandover}
                        onChange={() => toggleIncidentCarryToHandover(inc.id)}
                        className="rounded border-slate-700 text-[#06B6D4]"
                      />
                      <span>Carry forward to Day-to-Swing Handover Packet</span>
                    </label>

                    <div className="flex items-center gap-2">
                      {inc.status !== 'Resolved' && (
                        <button
                          onClick={() => resolveIncident(inc.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-slate-950 font-semibold text-xs transition-colors"
                        >
                          Mark Incident Resolved
                        </button>
                      )}
                      <button
                        onClick={() => setIncidentsSubView('handover')}
                        className="px-3 py-1.5 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-xs text-[#22D3EE] font-semibold"
                      >
                        Go to Handover Sign-Off →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Log New Incident Form */}
          <form
            onSubmit={handleLogIncident}
            className="lg:col-span-4 p-5 rounded-2xl bg-[#0D1117] border border-slate-800/90 space-y-3.5 h-fit"
          >
            <h2 className="font-display font-bold text-base text-slate-100">
              Log New Floor Incident
            </h2>
            <div className="space-y-1">
              <label htmlFor="inc-title" className="block text-xs font-semibold text-slate-300">
                Incident Title
              </label>
              <input
                id="inc-title"
                type="text"
                required
                value={newIncTitle}
                onChange={(e) => setNewIncTitle(e.target.value)}
                placeholder="e.g., Harmonic spike on Bus B2..."
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="inc-sev" className="block text-xs font-semibold text-slate-300">
                  Severity
                </label>
                <select
                  id="inc-sev"
                  value={newIncSeverity}
                  onChange={(e) =>
                    setNewIncSeverity(e.target.value as IncidentRecord['severity'])
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
                >
                  <option value="L1 · Minor">L1 · Minor</option>
                  <option value="L2 · Elevated">L2 · Elevated</option>
                  <option value="L3 · Critical">L3 · Critical</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="inc-zone" className="block text-xs font-semibold text-slate-300">
                  Sector / Zone
                </label>
                <select
                  id="inc-zone"
                  value={newIncZone}
                  onChange={(e) => setNewIncZone(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
                >
                  <option value="Sector A · Core Ops">Sector A · Core Ops</option>
                  <option value="Sector B · Substation">Sector B · Substation</option>
                  <option value="Sector C · Telemetry">Sector C · Telemetry</option>
                  <option value="Sector D · Dispatch">Sector D · Dispatch</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="inc-sum" className="block text-xs font-semibold text-slate-300">
                Telemetry Observation & Initial Mitigation
              </label>
              <textarea
                id="inc-sum"
                rows={3}
                value={newIncSummary}
                onChange={(e) => setNewIncSummary(e.target.value)}
                placeholder="Describe affected bus, relay, or station..."
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs transition-colors"
            >
              Create Incident & Generate Runbook
            </button>
          </form>
        </div>
      )}

      {/* SUBVIEW 2: SHIFT HANDOVER SIGN-OFF (Journey 4) */}
      {incidentsSubView === 'handover' && (
        <div className="rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[#22D3EE]">{handoverSession.id}</span>
                <span
                  className={`px-2.5 py-0.5 rounded font-mono text-xs font-semibold border ${
                    handoverSession.status === 'Signed Off & Sealed'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  }`}
                >
                  {handoverSession.status}
                </span>
              </div>
              <h2 className="font-display font-bold text-lg text-slate-100 mt-1">
                Day (1ST · 07:30–16:30) → Swing (2ND · 12:30–20:30) Handover Packet
              </h2>
              <p className="text-xs text-slate-400">
                Overlap Window: <strong className="font-mono text-[#22D3EE]">{handoverSession.overlapWindowLabel}</strong> ·
                Outgoing Lead: <strong className="text-slate-200">{handoverSession.outgoingLeadName}</strong> ·
                Incoming Lead: <strong className="text-slate-200">{handoverSession.incomingLeadName}</strong>
              </p>
            </div>
          </div>

          {/* 3 Mandatory Handover Verification Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#151B24] border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">System Uptime Verification</div>
              <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                {handoverSession.systemUptimePct}%
              </div>
              <div className="text-[11px] text-slate-400">SCADA & Substation Bus Nominal</div>
            </div>

            <div className="p-4 rounded-xl bg-[#151B24] border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Carried Incidents / Open Tickets</div>
              <div className="font-mono text-2xl font-bold text-[#22D3EE] tabular-nums">
                {carriedIncidents.length}
              </div>
              <div className="text-[11px] text-slate-400">
                {carriedIncidents.filter((i) => i.status === 'Resolved').length} resolved ·{' '}
                {carriedIncidents.filter((i) => i.status !== 'Resolved').length} active monitoring
              </div>
            </div>

            <label className="p-4 rounded-xl bg-[#151B24] border border-slate-800 flex items-center justify-between cursor-pointer">
              <div className="space-y-1">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#06B6D4]" />
                  Physical Interlock Key-Fob Transfer
                </div>
                <div className="font-display font-bold text-sm text-slate-100">
                  {handoverSession.keyFobTransferred
                    ? 'Verified & Transferred to Swing Lead'
                    : 'Pending Physical Verification'}
                </div>
              </div>
              <input
                type="checkbox"
                checked={handoverSession.keyFobTransferred}
                onChange={(e) =>
                  updateHandoverSession({ keyFobTransferred: e.target.checked })
                }
                className="w-5 h-5 rounded border-slate-700 text-[#06B6D4]"
              />
            </label>
          </div>

          {/* Carried Incidents Summary */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Attached Shift Incident Logs ({carriedIncidents.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {carriedIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-3 rounded-xl bg-[#151B24]/80 border border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-amber-300">{inc.id}</span>
                    <span className="font-mono text-emerald-300">{inc.status}</span>
                  </div>
                  <div className="font-display font-semibold text-xs text-slate-100">
                    {inc.title}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Outcome: {inc.outcomeNote || inc.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Outgoing Lead Summary Note & Incoming Lead Sign-off */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label
                htmlFor="handover-summary-textarea"
                className="block text-xs font-semibold text-slate-300"
              >
                Outgoing Shift Lead Summary ({handoverSession.outgoingLeadName})
              </label>
              <textarea
                id="handover-summary-textarea"
                rows={3}
                value={handoverSession.summaryNote}
                onChange={(e) => updateHandoverSession({ summaryNote: e.target.value })}
                className="w-full rounded-xl bg-[#151B24] border border-slate-800 px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="space-y-3 p-4 rounded-xl bg-[#151B24] border border-slate-800 flex flex-col justify-between">
              <div className="space-y-1.5">
                <label
                  htmlFor="incoming-lead-input"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Incoming Swing Shift Lead Co-Signature
                </label>
                <input
                  id="incoming-lead-input"
                  type="text"
                  value={incomingAckName}
                  onChange={(e) => setIncomingAckName(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 font-mono"
                />
              </div>

              {handoverSession.status === 'Signed Off & Sealed' ? (
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Handover sealed by {handoverSession.outgoingLeadName} &{' '}
                    {handoverSession.incomingLeadName}.
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => sealShiftHandover(incomingAckName)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <FileSignature className="w-4 h-4" />
                  Sign Off & Seal Day-to-Swing Handover
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
