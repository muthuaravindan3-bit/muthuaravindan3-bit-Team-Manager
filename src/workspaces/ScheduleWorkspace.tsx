import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Download,
  Calendar,
  Undo2,
  FileCheck2,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  BookmarkPlus,
  UserCheck,
  Clock,
  Lock,
  Layers
} from 'lucide-react';
import { useShiftSync } from '../context/ShiftSyncContext';
import { ShiftBadge } from '../components/ShiftBadge';
import {
  SHIFT_CATALOG,
  computeOperatorWeeklySummary,
  generateRosterCsv,
  generateOperatorIcs,
  triggerFileDownload
} from '../utils/shiftSyncEngine';
import { ShiftCode, ScheduleSubView } from '../data/shiftSyncTypes';
import { BOUNDARY_ASSIGNMENTS } from '../data/shiftSyncSeed';

export const ScheduleWorkspace: React.FC = () => {
  const {
    activeScope,
    activeScopeId,
    setActiveScopeId,
    scopes,
    selectedDate,
    setSelectedDate,
    scheduleSubView,
    setScheduleSubView,
    operators,
    coverageGaps,
    activeValidation,
    selectedCellKeys,
    toggleCellSelection,
    clearCellSelection,
    bulkUpdateAssignments,
    setSupportingPanel,
    generateAIAutopilotProposal,
    sandboxActive,
    sandboxAssignments,
    enterWhatIfSandbox,
    discardWhatIfSandbox,
    applySandboxToDraft,
    updateSandboxAssignment,
    undoStack,
    undoLastScheduleChange,
    saveCustomViewPreset,
    savedViews,
    activePersona,
    showToast
  } = useShiftSync();

  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [shiftFilter, setShiftFilter] = useState<ShiftCode | 'ALL'>('ALL');
  const [callOutOperatorId, setCallOutOperatorId] = useState<string | null>(null);

  const canManageSchedule = activePersona.permissionRole !== 'Operator';

  // Active assignment list (uses sandbox if sandbox is active)
  const effectiveAssignments = useMemo(
    () => (sandboxActive && sandboxAssignments ? sandboxAssignments : activeScope.assignments),
    [sandboxActive, sandboxAssignments, activeScope.assignments]
  );

  const zones = useMemo(
    () => ['ALL', ...Array.from(new Set(operators.map((o) => o.zone)))],
    [operators]
  );

  const filteredOperators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return operators.filter((op) => {
      if (zoneFilter !== 'ALL' && op.zone !== zoneFilter) return false;
      if (q) {
        const match =
          op.name.toLowerCase().includes(q) ||
          op.badgeCode.toLowerCase().includes(q) ||
          op.jobTitle.toLowerCase().includes(q) ||
          op.certifications.some((c) => c.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (shiftFilter !== 'ALL') {
        const hasShiftOnSelectedDate = effectiveAssignments.some(
          (a) =>
            a.operatorId === op.id &&
            a.date === selectedDate &&
            a.shiftCode === shiftFilter
        );
        if (!hasShiftOnSelectedDate) return false;
      }
      return true;
    });
  }, [operators, zoneFilter, searchQuery, shiftFilter, effectiveAssignments, selectedDate]);

  const handleExportCsv = () => {
    const csv = generateRosterCsv(activeScope, filteredOperators, BOUNDARY_ASSIGNMENTS);
    triggerFileDownload(
      `ShiftSync_Roster_${activeScope.startDate}_to_${activeScope.endDate}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    showToast(
      'Roster CSV Exported',
      `Exported ${filteredOperators.length} operators across ${activeScope.label}.`,
      'emerald'
    );
  };

  const handleExportIcs = () => {
    const targetOp =
      operators.find((o) => o.id === activePersona.operatorId) || filteredOperators[0];
    const ics = generateOperatorIcs(targetOp, activeScope.assignments);
    triggerFileDownload(
      `ShiftSync_${targetOp.badgeCode.replace('#', '')}_WorkingShifts.ics`,
      ics,
      'text/calendar;charset=utf-8'
    );
    showToast(
      'Calendar (.ICS) Exported',
      `Exported working shifts for ${targetOp.name} (WO & CO off-days excluded).`,
      'emerald'
    );
  };

  const draftChangedCount = activeScope.assignments.filter((a) => a.isDraftChanged).length;

  return (
    <div className="space-y-4">
      {/* Sandbox Banner when active */}
      {sandboxActive && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-display font-bold text-sm text-amber-200">
                What-If Sandbox Active · Isolated Experimentation Mode
              </div>
              <p className="text-xs text-amber-300/85">
                Click any roster cell to test shift rotations. Published schedule ({activeScope.version}) is completely untouched until you promote to Draft.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={applySandboxToDraft}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors"
            >
              Promote Sandbox to Draft
            </button>
            <button
              onClick={discardWhatIfSandbox}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-200 font-semibold text-xs transition-colors"
            >
              Discard Sandbox
            </button>
          </div>
        </div>
      )}

      {/* Top Schedule Command Header */}
      <div className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Period Switcher & Status Badge */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex rounded-xl bg-[#151B24] p-1 border border-slate-800">
              {Object.values(scopes).map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => {
                    setActiveScopeId(sc.id);
                    setSelectedDate(sc.days[sc.days.length - 1]);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                    activeScopeId === sc.id
                      ? 'bg-[#06B6D4] text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-slate-100'
                  }`}
                >
                  {sc.label} ({sc.version})
                </button>
              ))}
            </div>

            <span
              className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold border ${
                activeScope.status === 'Published'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : activeScope.status === 'Validated'
                  ? 'bg-[#06B6D4]/15 border-[#06B6D4]/40 text-[#22D3EE]'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              {activeScope.status} · {draftChangedCount} unpublished changes
            </span>
          </div>

          {/* Primary Actions: Autopilot, Sandbox, Exports, Validate & Publish */}
          <div className="flex items-center gap-2 flex-wrap">
            {undoStack.length > 0 && canManageSchedule && (
              <button
                onClick={undoLastScheduleChange}
                className="px-2.5 py-1.5 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5"
                title="Undo last roster change"
              >
                <Undo2 className="w-3.5 h-3.5 text-[#22D3EE]" />
                Undo ({undoStack.length})
              </button>
            )}

            {canManageSchedule && (
              <button
                onClick={() => generateAIAutopilotProposal('scope-2026-10-26')}
                className="px-3 py-1.5 rounded-xl bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4]/50 text-[#22D3EE] font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Week Autopilot (26 Oct–1 Nov)
              </button>
            )}

            {!sandboxActive && canManageSchedule && (
              <button
                onClick={enterWhatIfSandbox}
                className="px-3 py-1.5 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                What-If Sandbox
              </button>
            )}

            <button
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#22D3EE]" />
              CSV
            </button>

            <button
              onClick={handleExportIcs}
              className="px-2.5 py-1.5 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              .ICS
            </button>

            <button
              onClick={() =>
                setSupportingPanel({
                  kind: 'publication_review',
                  entityId: activeScope.id,
                  widthPx: 430
                })
              }
              className="px-3.5 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              Validate & Publish
            </button>
          </div>
        </div>

        {/* Sub-view Tabs + Filters Row */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* 4 Sub-view Tabs */}
          <div className="inline-flex rounded-xl bg-[#151B24] p-1 border border-slate-800">
            {(
              [
                { id: 'roster_table', label: 'Roster Table' },
                { id: 'week_grid', label: 'Week Grid' },
                { id: 'coverage_matrix', label: 'Coverage Matrix' },
                { id: 'timeline_24h', label: '24h Timeline' }
              ] as { id: ScheduleSubView; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setScheduleSubView(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  scheduleSubView === tab.id
                    ? 'bg-slate-800 text-[#22D3EE] border border-[#06B6D4]/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Zone Filter, Shift Filter, Day Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter name, #OP-XXXX, cert..."
                aria-label="Filter operators by name, badge ID, or certification"
                className="pl-8 pr-3 py-1.5 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#06B6D4] w-48"
              />
            </div>

            <select
              aria-label="Filter by zone"
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-[#06B6D4]"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z === 'ALL' ? 'All Sectors & Zones' : z}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by shift preset on selected day"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as ShiftCode | 'ALL')}
              className="px-2.5 py-1.5 rounded-xl bg-[#151B24] border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#06B6D4]"
            >
              <option value="ALL">All Shift Presets</option>
              {(['1ST', '2ND', '3RD', 'GEN', 'WO', 'CO'] as ShiftCode[]).map((c) => (
                <option key={c} value={c}>
                  {SHIFT_CATALOG[c].label} ({SHIFT_CATALOG[c].timeLabel})
                </option>
              ))}
            </select>

            <select
              aria-label="Select operational day"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[#151B24] border border-slate-800 text-xs font-mono text-[#22D3EE] focus:outline-none focus:border-[#06B6D4]"
            >
              {activeScope.days.map((d, idx) => (
                <option key={d} value={d}>
                  {activeScope.dayLabels[idx]} ({d})
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                saveCustomViewPreset(`${zoneFilter === 'ALL' ? 'All Zones' : zoneFilter} · ${shiftFilter}`, {
                  zone: zoneFilter,
                  shiftCode: shiftFilter,
                  searchQuery
                })
              }
              title="Save current filter preset"
              className="p-1.5 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-800 text-slate-300"
            >
              <BookmarkPlus className="w-4 h-4 text-[#22D3EE]" />
            </button>
          </div>
        </div>
      </div>

      {/* Saved View Pills & Call-Out Stress Probe Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono uppercase text-slate-400 mr-1">
            Quick Views:
          </span>
          {savedViews.map((sv) => (
            <button
              key={sv.id}
              onClick={() => {
                if (sv.subView) setScheduleSubView(sv.subView);
                if (sv.filters.zone) setZoneFilter(sv.filters.zone);
                if (sv.filters.shiftCode) setShiftFilter(sv.filters.shiftCode);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#0D1117] hover:bg-[#151B24] border border-slate-800 text-xs text-slate-300 transition-colors"
            >
              {sv.name}
            </button>
          ))}
          {(zoneFilter !== 'ALL' || shiftFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setZoneFilter('ALL');
                setShiftFilter('ALL');
                setSearchQuery('');
              }}
              className="px-2 py-1 rounded-lg text-xs text-[#22D3EE] hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Call-Out Stress Probe Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Call-Out Stress Probe:</span>
          <select
            aria-label="Run unplanned call-out stress probe for operator"
            value={callOutOperatorId || ''}
            onChange={(e) => setCallOutOperatorId(e.target.value || null)}
            className="px-2.5 py-1 rounded-lg bg-[#0D1117] border border-slate-800 text-xs text-amber-300 font-mono"
          >
            <option value="">Simulate Unplanned Absence...</option>
            {operators.slice(0, 8).map((op) => (
              <option key={op.id} value={op.id}>
                Simulate Call-Out: {op.name} ({op.badgeCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Call-Out Stress Probe Result Panel */}
      {callOutOperatorId && (() => {
        const absentOp = operators.find((o) => o.id === callOutOperatorId);
        if (!absentOp) return null;
        return (
          <div className="p-4 rounded-2xl bg-[#0D1117] border border-amber-500/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="font-display font-bold text-sm text-slate-100">
                  Call-Out Stress Probe · If {absentOp.name} ({absentOp.badgeCode}) calls out on {selectedDate}
                </span>
              </div>
              <button
                onClick={() => setCallOutOperatorId(null)}
                className="text-xs text-slate-400 hover:text-slate-100"
              >
                Close Probe ✕
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Zone impact: <strong className="text-amber-300">{absentOp.zone}</strong> drops by 1 certified operator ({absentOp.certifications.join(', ')}). Ranked replacement candidates with ≥11h rest:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {coverageGaps[0]?.candidates.map((cand) => {
                const op = operators.find((o) => o.id === cand.operatorId);
                if (!op) return null;
                return (
                  <div
                    key={cand.operatorId}
                    className="p-3 rounded-xl bg-[#151B24] border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-display font-bold text-xs text-slate-100">
                        {op.name} ({op.badgeCode})
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        Rest: {cand.restHoursBefore}h · Proj: {cand.projectedWeeklyHours}h
                      </div>
                      <div className="text-[11px] text-emerald-300 mt-0.5">
                        {cand.ineligibleReason ? cand.ineligibleReason : 'Eligible immediate cover'}
                      </div>
                    </div>
                    {!cand.ineligibleReason && (
                      <button
                        onClick={() =>
                          setSupportingPanel({
                            kind: 'coverage_gap',
                            entityId: coverageGaps[0].id,
                            widthPx: 440
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-[#06B6D4] text-slate-950 font-semibold text-xs shrink-0"
                      >
                        Stage
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Multi-Cell Bulk Edit Bar */}
      {selectedCellKeys.length > 0 && canManageSchedule && (
        <div className="p-3 rounded-2xl bg-[#151B24] border border-[#06B6D4] flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-[#06B6D4] text-slate-950 font-mono font-bold">
              {selectedCellKeys.length} cells selected
            </span>
            <span className="text-slate-300">Apply shift preset to all selected unlocked cells:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['1ST', '2ND', '3RD', 'GEN', 'WO', 'CO'] as ShiftCode[]).map((code) => (
              <button
                key={code}
                onClick={() => bulkUpdateAssignments(activeScope.id, selectedCellKeys, code)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-100"
              >
                Set {code}
              </button>
            ))}
            <button
              onClick={clearCellSelection}
              className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-100"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: ROSTER TABLE */}
      {scheduleSubView === 'roster_table' && (
        <div className="rounded-2xl bg-[#0D1117] border border-slate-800/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#151B24] border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  <th className="sticky left-0 z-10 bg-[#151B24] px-4 py-3 min-w-[250px] border-r border-slate-800">
                    Operator · Badge · Role & Certs
                  </th>
                  {activeScope.days.map((d, idx) => {
                    const isSelectedDay = d === selectedDate;
                    return (
                      <th
                        key={d}
                        onClick={() => setSelectedDate(d)}
                        className={`px-3 py-3 min-w-[132px] cursor-pointer transition-colors border-r border-slate-800/60 ${
                          isSelectedDay
                            ? 'bg-[#06B6D4]/15 text-[#22D3EE]'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{activeScope.dayLabels[idx]}</span>
                          {d === '2026-10-25' && (
                            <span className="px-1.5 py-0.2 rounded bg-[#06B6D4]/20 text-[#22D3EE] text-[9px]">
                              TODAY
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="sticky right-0 z-10 bg-[#151B24] px-4 py-3 min-w-[165px] border-l border-slate-800 text-right">
                    Weekly Hrs · Rest
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {filteredOperators.map((op) => {
                  const summary = computeOperatorWeeklySummary(
                    op.id,
                    activeScope.days,
                    effectiveAssignments,
                    BOUNDARY_ASSIGNMENTS
                  );

                  return (
                    <tr
                      key={op.id}
                      className="hover:bg-[#151B24]/50 transition-colors group"
                    >
                      {/* Sticky Operator Identity Column */}
                      <td className="sticky left-0 z-10 bg-[#0D1117] group-hover:bg-[#151B24] px-4 roster-cell border-r border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() =>
                              setSupportingPanel({
                                kind: 'operator_dossier',
                                entityId: op.id,
                                widthPx: 430
                              })
                            }
                            className="font-display font-bold text-slate-100 hover:text-[#22D3EE] text-left truncate"
                          >
                            {op.name}
                          </button>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[#22D3EE] shrink-0">
                            {op.badgeCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {op.jobTitle} · {op.zone.split('·')[0]}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {op.certifications.map((c) => (
                            <span
                              key={c}
                              className="px-1.5 py-0.2 rounded bg-slate-900/90 text-[10px] font-mono text-slate-300 border border-slate-800"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* 7 Day Shift Cells */}
                      {activeScope.days.map((d) => {
                        const cell = effectiveAssignments.find(
                          (a) => a.operatorId === op.id && a.date === d
                        );
                        const cellKey = `${op.id}__${d}`;
                        const isSelected = selectedCellKeys.includes(cellKey);
                        const isSelectedDay = d === selectedDate;

                        return (
                          <td
                            key={d}
                            className={`px-2.5 roster-cell border-r border-slate-800/50 transition-colors ${
                              isSelected
                                ? 'bg-[#06B6D4]/20 ring-1 inset-ring ring-[#06B6D4]'
                                : isSelectedDay
                                ? 'bg-[#06B6D4]/[0.04]'
                                : ''
                            }`}
                          >
                            {cell ? (
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  onClick={(e) => {
                                    if (e.shiftKey) {
                                      toggleCellSelection(cellKey);
                                      return;
                                    }
                                    if (sandboxActive) {
                                      const order: ShiftCode[] = ['1ST', '2ND', '3RD', 'GEN', 'WO', 'CO'];
                                      const nextCode =
                                        order[(order.indexOf(cell.shiftCode) + 1) % order.length];
                                      updateSandboxAssignment(op.id, d, nextCode);
                                    } else {
                                      setSupportingPanel({
                                        kind: 'assignment_edit',
                                        entityId: op.id,
                                        secondaryId: d,
                                        widthPx: 430
                                      });
                                    }
                                  }}
                                  className="w-full text-left focus:outline-none focus:ring-1 focus:ring-[#06B6D4] rounded-md"
                                >
                                  <ShiftBadge
                                    shiftCode={cell.shiftCode}
                                    showTime
                                    size="xs"
                                    isDraftChanged={cell.isDraftChanged}
                                    isLocked={cell.locked}
                                    className="w-full justify-between"
                                  />
                                </button>
                                {canManageSchedule && !cell.locked && (
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${op.name} on ${d} for bulk edit`}
                                    checked={isSelected}
                                    onChange={() => toggleCellSelection(cellKey)}
                                    className="rounded border-slate-700 bg-slate-900 text-[#06B6D4] opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 font-mono text-[11px]">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Sticky Weekly Summary Column */}
                      <td className="sticky right-0 z-10 bg-[#0D1117] group-hover:bg-[#151B24] px-4 roster-cell border-l border-slate-800 text-right font-mono">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`font-bold tabular-nums ${
                              summary.hasOvertimeAdvisory ? 'text-amber-300' : 'text-slate-100'
                            }`}
                          >
                            {summary.totalScheduledHours}h
                          </span>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            ({summary.totalPaidHours}h paid)
                          </span>
                        </div>
                        <div className="text-[11px] mt-0.5 flex items-center justify-end gap-1.5">
                          <span className="text-slate-400">
                            Min rest: {summary.minRestHours === 99 ? '≥24h' : `${summary.minRestHours}h`}
                          </span>
                          {summary.hasRestViolation ? (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                              &lt;11h VIOL
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">
                              OK
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: WEEK GRID */}
      {scheduleSubView === 'week_grid' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {activeScope.days.map((d, idx) => {
            const dayAssignments = effectiveAssignments.filter((a) => a.date === d);
            const working = dayAssignments.filter((a) => !['WO', 'CO'].includes(a.shiftCode));
            const off = dayAssignments.filter((a) => ['WO', 'CO'].includes(a.shiftCode));

            return (
              <div
                key={d}
                className={`rounded-2xl bg-[#0D1117] border p-3.5 space-y-3 ${
                  d === selectedDate ? 'border-[#06B6D4]' : 'border-slate-800/90'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <div className="font-display font-bold text-sm text-slate-100">
                      {activeScope.dayLabels[idx]}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">{d}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#151B24] border border-slate-700 font-mono text-xs text-[#22D3EE]">
                    {working.length} active
                  </span>
                </div>

                {(['1ST', '2ND', '3RD', 'GEN'] as ShiftCode[]).map((code) => {
                  const opsOnShift = dayAssignments.filter((a) => a.shiftCode === code);
                  return (
                    <div
                      key={code}
                      className="p-2.5 rounded-xl bg-[#151B24]/80 border border-slate-800/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <ShiftBadge shiftCode={code} size="xs" />
                        <span className="font-mono text-xs font-bold text-slate-200">
                          {opsOnShift.length} ops
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {SHIFT_CATALOG[code].timeLabel}
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {opsOnShift.map((a) => {
                          const op = operators.find((o) => o.id === a.operatorId);
                          return (
                            <button
                              key={a.operatorId}
                              onClick={() =>
                                setSupportingPanel({
                                  kind: 'operator_dossier',
                                  entityId: a.operatorId,
                                  widthPx: 430
                                })
                              }
                              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-200 truncate max-w-full"
                            >
                              {op?.name.split(' ')[0]} ({op?.badgeCode})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-1 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>WO / CO Off-Roster:</span>
                  <span>{off.length} operators</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: COVERAGE MATRIX */}
      {scheduleSubView === 'coverage_matrix' && (
        <div className="rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-base text-slate-100">
                Shift Coverage Matrix · {activeScope.label}
              </h2>
              <p className="text-xs text-slate-400">
                Staffed Headcount vs Preferred Target (Hard Minimum) across all 4 working shift presets.
              </p>
            </div>
            {coverageGaps.length > 0 && (
              <button
                onClick={() =>
                  setSupportingPanel({
                    kind: 'coverage_gap',
                    entityId: coverageGaps[0].id,
                    widthPx: 440
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs transition-colors"
              >
                Resolve Open Night Gap ({coverageGaps[0].id})
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#151B24] border-b border-slate-800 font-mono text-[11px] uppercase text-slate-400">
                  <th className="px-4 py-3">Shift Preset · Window</th>
                  <th className="px-3 py-3">Preferred Target (Hard Min)</th>
                  {activeScope.days.map((d, idx) => (
                    <th key={d} className="px-3 py-3 text-center">
                      {activeScope.dayLabels[idx]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(
                  [
                    { code: '1ST' as ShiftCode, pref: 9, min: 8 },
                    { code: '2ND' as ShiftCode, pref: 7, min: 6 },
                    { code: '3RD' as ShiftCode, pref: 4, min: 3 },
                    { code: 'GEN' as ShiftCode, pref: 2, min: 2 }
                  ]
                ).map((row) => {
                  const meta = SHIFT_CATALOG[row.code];
                  return (
                    <tr key={row.code} className="hover:bg-[#151B24]/50">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <ShiftBadge shiftCode={row.code} showTime size="sm" />
                        </div>
                      </td>
                      <td className="px-3 py-3.5 font-mono text-slate-300">
                        {row.pref} ops <span className="text-slate-400">(Min {row.min})</span>
                      </td>
                      {activeScope.days.map((d) => {
                        const staffed = effectiveAssignments.filter(
                          (a) => a.date === d && a.shiftCode === row.code
                        ).length;
                        const isBelowMin = staffed < row.min;
                        const isBelowPref = staffed < row.pref;

                        return (
                          <td key={d} className="px-3 py-3.5 text-center font-mono">
                            <button
                              onClick={() => {
                                setSelectedDate(d);
                                if (isBelowPref && coverageGaps[0]) {
                                  setSupportingPanel({
                                    kind: 'coverage_gap',
                                    entityId: coverageGaps[0].id,
                                    widthPx: 440
                                  });
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg border font-bold tabular-nums transition-colors ${
                                isBelowMin
                                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                                  : isBelowPref
                                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                              }`}
                            >
                              {staffed}/{row.pref}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: 24H TIMELINE & OVERLAP INSPECTOR */}
      {scheduleSubView === 'timeline_24h' && (
        <div className="rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-base text-slate-100">
                24-Hour Chrono-Timeline & Handover Overlap · {selectedDate}
              </h2>
              <p className="text-xs text-slate-400">
                Visualizing 1ST · Day (07:30–16:30), 2ND · Swing (12:30–20:30), 3RD · Night (20:30–07:30+1d), and GEN · General (09:00–18:00).
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/40 text-[#22D3EE]">
                Handover Overlap: 12:30–16:30 (4h)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                Demo Clock: 14:00 IST
              </span>
            </div>
          </div>

          {/* 24-Hour Horizontal Ruler (00:00 to 24:00) */}
          <div className="relative rounded-xl bg-[#151B24] border border-slate-800 p-4 space-y-3 overflow-x-auto">
            <div className="min-w-[780px] space-y-3">
              {/* Hour ruler */}
              <div className="grid grid-cols-24 text-[10px] font-mono text-slate-400 border-b border-slate-800 pb-2">
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-center">
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Highlighted Overlap Band (12:30 to 16:30 = 52.08% to 68.75%) */}
              <div className="relative h-44 space-y-2.5">
                <div
                  style={{ left: '52.08%', width: '16.67%' }}
                  className="absolute top-0 bottom-0 bg-[#06B6D4]/10 border-x border-dashed border-[#06B6D4]/60 pointer-events-none flex flex-col justify-end items-center pb-1"
                >
                  <span className="font-mono text-[10px] text-[#22D3EE] bg-slate-950/90 px-1.5 py-0.5 rounded">
                    12:30–16:30 OVERLAP
                  </span>
                </div>

                {/* 14:00 IST Vertical Marker (58.33%) */}
                <div
                  style={{ left: '58.33%' }}
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-20 pointer-events-none"
                >
                  <span className="absolute -top-2 -translate-x-1/2 px-1.5 py-0.2 rounded bg-emerald-400 text-slate-950 font-mono text-[9px] font-bold">
                    14:00 IST
                  </span>
                </div>

                {/* Band 1: 1ST · Day (07:30–16:30 -> left 31.25%, width 37.5%) */}
                <div className="relative h-8 bg-slate-900/80 rounded-lg overflow-hidden flex items-center">
                  <div
                    style={{ left: '31.25%', width: '37.5%' }}
                    className="absolute h-full bg-[#06B6D4]/25 border border-[#06B6D4] rounded-md px-2.5 flex items-center justify-between text-xs font-mono text-[#22D3EE]"
                  >
                    <span className="font-bold">1ST · Day (07:30–16:30)</span>
                    <span>
                      {
                        effectiveAssignments.filter(
                          (a) => a.date === selectedDate && a.shiftCode === '1ST'
                        ).length
                      }{' '}
                      operators
                    </span>
                  </div>
                </div>

                {/* Band 2: GEN · General (09:00–18:00 -> left 37.5%, width 37.5%) */}
                <div className="relative h-8 bg-slate-900/80 rounded-lg overflow-hidden flex items-center">
                  <div
                    style={{ left: '37.5%', width: '37.5%' }}
                    className="absolute h-full bg-[#F59E0B]/20 border border-[#F59E0B] rounded-md px-2.5 flex items-center justify-between text-xs font-mono text-[#FBBF24]"
                  >
                    <span className="font-bold">GEN · General (09:00–18:00)</span>
                    <span>
                      {
                        effectiveAssignments.filter(
                          (a) => a.date === selectedDate && a.shiftCode === 'GEN'
                        ).length
                      }{' '}
                      operators
                    </span>
                  </div>
                </div>

                {/* Band 3: 2ND · Swing (12:30–20:30 -> left 52.08%, width 33.33%) */}
                <div className="relative h-8 bg-slate-900/80 rounded-lg overflow-hidden flex items-center">
                  <div
                    style={{ left: '52.08%', width: '33.33%' }}
                    className="absolute h-full bg-[#10B981]/25 border border-[#10B981] rounded-md px-2.5 flex items-center justify-between text-xs font-mono text-[#34D399]"
                  >
                    <span className="font-bold">2ND · Swing (12:30–20:30)</span>
                    <span>
                      {
                        effectiveAssignments.filter(
                          (a) => a.date === selectedDate && a.shiftCode === '2ND'
                        ).length
                      }{' '}
                      operators
                    </span>
                  </div>
                </div>

                {/* Band 4: 3RD · Night (20:30–24:00 + 00:00–07:30 overnight) */}
                <div className="relative h-8 bg-slate-900/80 rounded-lg overflow-hidden flex items-center">
                  {/* Morning carry-in 00:00-07:30 */}
                  <div
                    style={{ left: '0%', width: '31.25%' }}
                    className="absolute h-full bg-[#818CF8]/20 border border-[#818CF8]/70 rounded-r-md px-2 flex items-center text-[11px] font-mono text-[#A5B4FC]"
                  >
                    <span>3RD Carry-in (00:00–07:30)</span>
                  </div>
                  {/* Evening start 20:30-24:00 */}
                  <div
                    style={{ left: '85.42%', width: '14.58%' }}
                    className="absolute h-full bg-[#818CF8]/30 border border-[#818CF8] rounded-l-md px-2 flex items-center justify-between text-[11px] font-mono text-[#A5B4FC]"
                  >
                    <span className="font-bold">3RD (20:30→)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Operator timeline rows for selectedDate */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredOperators.map((op) => {
              const cell = effectiveAssignments.find(
                (a) => a.operatorId === op.id && a.date === selectedDate
              );
              return (
                <div
                  key={op.id}
                  onClick={() =>
                    setSupportingPanel({
                      kind: 'assignment_edit',
                      entityId: op.id,
                      secondaryId: selectedDate,
                      widthPx: 430
                    })
                  }
                  className="p-3 rounded-xl bg-[#151B24]/80 hover:bg-[#151B24] border border-slate-800 cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-xs text-slate-100 truncate">
                      {op.name}{' '}
                      <span className="font-mono text-[11px] text-[#22D3EE]">{op.badgeCode}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{op.zone}</div>
                  </div>
                  {cell && <ShiftBadge shiftCode={cell.shiftCode} showTime size="xs" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
