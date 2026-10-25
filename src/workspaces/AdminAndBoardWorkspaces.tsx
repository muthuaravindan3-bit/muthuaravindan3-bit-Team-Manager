import React, { useState } from 'react';
import {
  Shield,
  Sliders,
  FileText,
  Radio,
  Plug,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Layers,
  RotateCcw,
  GitCompare,
  Sparkles
} from 'lucide-react';
import { useShiftSync } from '../context/ShiftSyncContext';
import { ShiftBadge } from '../components/ShiftBadge';
import { SHIFT_CATALOG } from '../utils/shiftSyncEngine';
import { AdminSubView, PersonaId, ShiftCode, BroadcastNotice } from '../data/shiftSyncTypes';

export const AdminGuardianWorkspace: React.FC = () => {
  const {
    adminSubView,
    setAdminSubView,
    operators,
    rulesConfig,
    updateRulesConfig,
    updateOperatorRole,
    auditLog,
    broadcasts,
    sendBroadcastNotice,
    activePersona
  } = useShiftSync();

  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcSeverity, setBcSeverity] = useState<BroadcastNotice['severity']>('info');
  const [bcZone, setBcZone] = useState('All Floor Sectors');

  const isAdmin = activePersona.permissionRole === 'Administrator' || activePersona.permissionRole === 'Shift Lead';

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcTitle.trim() || !bcMessage.trim()) return;
    sendBroadcastNotice(bcTitle.trim(), bcMessage.trim(), bcSeverity, bcZone);
    setBcTitle('');
    setBcMessage('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            Admin Guardian · Governance, Rules & Audit
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage RBAC permission roles separately from job titles, configure turnaround guardrails, and inspect the immutable audit trail.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-[#151B24] p-1 border border-slate-800 flex-wrap">
          {(
            [
              { id: 'members_roles', label: 'Members & Roles' },
              { id: 'scheduling_rules', label: 'Scheduling Rules' },
              { id: 'audit_log', label: `Audit Log (${auditLog.length})` },
              { id: 'broadcasts', label: `Broadcasts (${broadcasts.length})` },
              { id: 'integrations', label: 'Integrations' }
            ] as { id: AdminSubView; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAdminSubView(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                adminSubView === tab.id
                  ? 'bg-slate-800 text-[#22D3EE] border border-[#06B6D4]/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. MEMBERS & ROLES */}
      {adminSubView === 'members_roles' && (
        <div className="rounded-2xl bg-[#0D1117] border border-slate-800/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#151B24] border-b border-slate-800 font-mono text-[11px] uppercase text-slate-400">
                  <th className="px-4 py-3">Operator · Badge ID</th>
                  <th className="px-4 py-3">Job Title / Specialty</th>
                  <th className="px-4 py-3">Assigned Zone · Squad</th>
                  <th className="px-4 py-3">Certifications</th>
                  <th className="px-4 py-3">Permission Role (RBAC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {operators.map((op) => {
                  const roleMap: Record<string, PersonaId> = {
                    Operator: 'operator',
                    'Shift Lead': 'shift_lead',
                    Administrator: 'admin'
                  };
                  return (
                    <tr key={op.id} className="hover:bg-[#151B24]/50">
                      <td className="px-4 py-3 font-display font-bold text-slate-100">
                        {op.name}{' '}
                        <span className="font-mono text-xs text-[#22D3EE] ml-1">
                          {op.badgeCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{op.jobTitle}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {op.zone} · {op.squad}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {op.certifications.map((c) => (
                            <span
                              key={c}
                              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Change permission role for ${op.name}`}
                          disabled={!isAdmin}
                          value={roleMap[op.permissionRole] || 'operator'}
                          onChange={(e) =>
                            updateOperatorRole(op.id, e.target.value as PersonaId)
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#151B24] border border-slate-700 font-mono text-xs text-slate-100"
                        >
                          <option value="operator">Operator</option>
                          <option value="shift_lead">Shift Lead</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SCHEDULING RULES */}
      {adminSubView === 'scheduling_rules' && (
        <div className="rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 space-y-5">
          <div>
            <h2 className="font-display font-bold text-base text-slate-100">
              Active Scheduling Guardrails & Staffing Thresholds
            </h2>
            <p className="text-xs text-slate-400">
              Changes immediately re-evaluate active schedule scopes and update the Validation Gate.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#151B24] border border-slate-800 space-y-2">
              <label
                htmlFor="rule-rest-hours"
                className="block text-xs font-semibold text-slate-200"
              >
                Minimum Turnaround Rest Between Shifts (Blocking Rule)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="rule-rest-hours"
                  type="number"
                  min={8}
                  max={16}
                  value={rulesConfig.minRestHours}
                  onChange={(e) =>
                    updateRulesConfig({ minRestHours: Number(e.target.value) })
                  }
                  className="w-24 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm text-[#22D3EE]"
                />
                <span className="font-mono text-xs text-slate-400">hours (Default: 11h)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Any consecutive shift pair with less than {rulesConfig.minRestHours}h turnaround triggers a blocking error.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#151B24] border border-slate-800 space-y-2">
              <label
                htmlFor="rule-weekly-cap"
                className="block text-xs font-semibold text-slate-200"
              >
                Weekly Scheduled Hours Advisory Threshold
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="rule-weekly-cap"
                  type="number"
                  min={36}
                  max={60}
                  value={rulesConfig.weeklyHoursAdvisoryLimit}
                  onChange={(e) =>
                    updateRulesConfig({
                      weeklyHoursAdvisoryLimit: Number(e.target.value)
                    })
                  }
                  className="w-24 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm text-amber-300"
                />
                <span className="font-mono text-xs text-slate-400">hours/wk (Default: 48h)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Operators exceeding {rulesConfig.weeklyHoursAdvisoryLimit}h scheduled hours trigger an overtime advisory warning.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#151B24] border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-200">
                Active Floor Coverage Targets (14:00 IST Overlap)
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Hard Minimum</div>
                  <div className="text-base font-bold text-emerald-400">
                    {rulesConfig.hardMinimumFloorCoverage} ops
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Preferred Target</div>
                  <div className="text-base font-bold text-[#22D3EE]">
                    {rulesConfig.preferredFloorTarget} ops
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Firestore Shift Timing Standards Migration Runner */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#22D3EE]" />
                  Firestore Shift Timing Standards & Migration Engine
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronizes all existing documents in <span className="font-mono text-slate-200">shifts</span> and <span className="font-mono text-slate-200">shiftTemplates</span> collections to the mandatory 2026 timing standards.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 font-mono text-[11px] text-emerald-300">
                  Database: ai-studio-d5840258-ac78-45c8-9272-b8bd0b27064c
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="p-2.5 rounded-lg bg-[#151B24]/90 border border-[#06B6D4]/40 space-y-1">
                <div className="font-mono text-xs font-bold text-[#22D3EE]">1ST · Day</div>
                <div className="font-mono text-[11px] text-slate-200">07:30–16:30</div>
                <div className="text-[10px] text-slate-400">9h scheduled · Cyan</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#151B24]/90 border border-[#10B981]/40 space-y-1">
                <div className="font-mono text-xs font-bold text-[#34D399]">2ND · Swing</div>
                <div className="font-mono text-[11px] text-slate-200">12:30–20:30</div>
                <div className="text-[10px] text-slate-400">8h scheduled · Emerald</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#151B24]/90 border border-[#818CF8]/40 space-y-1">
                <div className="font-mono text-xs font-bold text-[#A5B4FC]">3RD · Night</div>
                <div className="font-mono text-[11px] text-slate-200">20:30–07:30</div>
                <div className="text-[10px] text-slate-400">11h wrap · Indigo</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#151B24]/90 border border-[#F59E0B]/40 space-y-1">
                <div className="font-mono text-xs font-bold text-[#FBBF24]">GEN · General</div>
                <div className="font-mono text-[11px] text-slate-200">09:00–18:00</div>
                <div className="text-[10px] text-slate-400">9h scheduled · Amber</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#151B24]/90 border border-slate-700/80 space-y-1">
                <div className="font-mono text-xs font-bold text-slate-400">WO · Week Off</div>
                <div className="font-mono text-[11px] text-slate-200">00:00–00:00</div>
                <div className="text-[10px] text-slate-400">0h rest · Slate</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#151B24]/90 border border-[#06B6D4]/60 space-y-1">
                <div className="font-mono text-xs font-bold text-cyan-200">CO · Comp Off</div>
                <div className="font-mono text-[11px] text-slate-200">09:00–17:00</div>
                <div className="text-[10px] text-slate-400">0h rest · Cyan border</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                CLI automated migration command available via npm:
                <code className="ml-2 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[#22D3EE] text-xs">
                  npm run migrate:shifts
                </code>
              </div>
              <div className="text-xs font-mono text-slate-400">
                Dry Run Preview: <span className="text-[#34D399]">npm run migrate:shifts:dry</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. AUDIT LOG */}
      {adminSubView === 'audit_log' && (
        <div className="rounded-2xl bg-[#0D1117] border border-slate-800/90 p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-300">
            Immutable Governance & Schedule Publication Trail
          </div>
          <div className="space-y-2">
            {auditLog.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-xl bg-[#151B24] border border-slate-800 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#22D3EE]">{entry.id}</span>
                    <span className="font-display font-bold text-xs text-slate-100">
                      {entry.action}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-300">
                      {entry.scope}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{entry.detail}</p>
                </div>
                <div className="text-right font-mono text-[11px] text-slate-400">
                  <div className="text-slate-200">
                    {entry.actorName} ({entry.actorRole})
                  </div>
                  <div>{entry.timestampIso}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. BROADCASTS */}
      {adminSubView === 'broadcasts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <form
            onSubmit={handleSendBroadcast}
            className="lg:col-span-5 p-5 rounded-2xl bg-[#0D1117] border border-slate-800/90 space-y-3.5 h-fit"
          >
            <h2 className="font-display font-bold text-base text-slate-100">
              Dispatch Floor Broadcast Notice
            </h2>
            <div className="space-y-1">
              <label htmlFor="bc-title" className="block text-xs font-semibold text-slate-300">
                Broadcast Title
              </label>
              <input
                id="bc-title"
                type="text"
                required
                value={bcTitle}
                onChange={(e) => setBcTitle(e.target.value)}
                placeholder="e.g., Swing Handover Briefing at 15:45 IST"
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="bc-zone" className="block text-xs font-semibold text-slate-300">
                  Target Sector
                </label>
                <select
                  id="bc-zone"
                  value={bcZone}
                  onChange={(e) => setBcZone(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
                >
                  <option value="All Floor Sectors">All Floor Sectors</option>
                  <option value="Sector A · Core Ops">Sector A · Core Ops</option>
                  <option value="Sector B · Substation">Sector B · Substation</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="bc-sev" className="block text-xs font-semibold text-slate-300">
                  Priority Tone
                </label>
                <select
                  id="bc-sev"
                  value={bcSeverity}
                  onChange={(e) =>
                    setBcSeverity(e.target.value as BroadcastNotice['severity'])
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
                >
                  <option value="info">Operational Info</option>
                  <option value="warning">Elevated Advisory</option>
                  <option value="urgent">Urgent Action</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="bc-msg" className="block text-xs font-semibold text-slate-300">
                Message Content
              </label>
              <textarea
                id="bc-msg"
                rows={3}
                required
                value={bcMessage}
                onChange={(e) => setBcMessage(e.target.value)}
                placeholder="Enter concise floor instruction..."
                className="w-full px-3 py-2 rounded-xl bg-[#151B24] border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-semibold text-xs transition-colors"
            >
              Send Broadcast to Active Consoles
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#22D3EE]">{b.id} · {b.targetZone}</span>
                  <span className="font-mono text-slate-400">{b.sentBy}</span>
                </div>
                <div className="font-display font-bold text-sm text-slate-100">{b.title}</div>
                <p className="text-xs text-slate-300">{b.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. INTEGRATIONS */}
      {adminSubView === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: 'SCADA Telemetry & Station Presence Bus',
              status: 'Simulated Demo Feed · Active',
              desc: 'Provides station occupancy, AGV battery telemetry, and L1/L2 substation alerts for Sunday 25 Oct 2026 14:00 IST.'
            },
            {
              name: 'Autonomous Week Autopilot Solver',
              status: 'Local Deterministic Engine · Active',
              desc: 'Evaluates 11h turnaround guardrails, 48h weekly caps, and certification parity in isolated proposal state.'
            },
            {
              name: 'iCalendar (.ICS) & Roster CSV Exporter',
              status: 'Browser Native · Active',
              desc: 'Generates RFC-5545 working shift calendar exports (excluding WO/CO off-days) and UTF-8 roster spreadsheets.'
            }
          ].map((intg) => (
            <div
              key={intg.name}
              className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Plug className="w-4 h-4 text-[#06B6D4]" />
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 font-mono text-[10px] text-emerald-300">
                  {intg.status}
                </span>
              </div>
              <div className="font-display font-bold text-sm text-slate-100">{intg.name}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{intg.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ComponentStateBoardWorkspace: React.FC = () => {
  const {
    density,
    setDensity,
    highContrast,
    setHighContrast,
    triggerSimulatedConflict,
    generateAIAutopilotProposal,
    resetDemoState,
    setSupportingPanel,
    setActiveWorkspace
  } = useShiftSync();

  const shiftCodes: ShiftCode[] = ['1ST', '2ND', '3RD', 'GEN', 'WO', 'CO'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-[#0D1117] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-[#06B6D4]/20 border border-[#06B6D4]/40 font-mono text-[10px] text-[#22D3EE]">
            §23 DESIGN SYSTEM & INTERACTION VERIFICATION
          </span>
          <h1 className="font-display text-xl font-bold text-slate-100 mt-1">
            Component & State Verification Board
          </h1>
          <p className="text-xs text-slate-400">
            Inspect Precision Sci-Fi Glass HUD surface tokens, shift taxonomy badges, density/contrast modes, and interactive edge-case states.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
            className="px-3.5 py-2 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 font-mono text-xs text-slate-100"
          >
            Density: <strong className="text-[#22D3EE] uppercase">{density}</strong>
          </button>
          <button
            onClick={() => setHighContrast(!highContrast)}
            className="px-3.5 py-2 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-700 font-mono text-xs text-slate-100"
          >
            High Contrast: <strong className="text-[#22D3EE]">{highContrast ? 'ON' : 'OFF'}</strong>
          </button>
          <button
            onClick={resetDemoState}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 font-mono text-xs text-rose-300 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Baseline (v2.4)
          </button>
        </div>
      </div>

      {/* Section 1: Shift Taxonomy & Semantic Distinction (GEN Amber vs Warning Alert) */}
      <section className="rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 space-y-4">
        <h2 className="font-display font-bold text-base text-slate-100">
          1. Shift Taxonomy & Semantic Token Verification
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {shiftCodes.map((code) => {
            const meta = SHIFT_CATALOG[code];
            return (
              <div
                key={code}
                className="p-3.5 rounded-xl bg-[#151B24] border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <ShiftBadge shiftCode={code} showTime size="md" />
                  <span className="font-mono text-xs text-slate-400">
                    {meta.scheduledHours}h sched / {meta.paidHours}h paid
                  </span>
                </div>
                <div className="text-xs text-slate-200 font-semibold">{meta.label}</div>
                <p className="text-[11px] text-slate-400">{meta.description}</p>
              </div>
            );
          })}
        </div>

        {/* Explicit GEN Shift Badge vs Operational Warning Alert Comparison (§4 rule) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#151B24] border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">
                Neutral Schedule Assignment Badge (GEN · General)
              </div>
              <div className="text-[11px] text-slate-400">
                Uses shift dot + tabular time window without hazard iconography
              </div>
            </div>
            <ShiftBadge shiftCode="GEN" showTime size="md" />
          </div>

          <div className="p-3.5 rounded-xl bg-amber-950/35 border-l-4 border-amber-400 border-y border-r border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-200 uppercase font-mono">
                  ADVISORY WARNING BANNER
                </div>
                <div className="text-[11px] text-amber-300/90">
                  Uses hazard icon + left accent bar + explicit severity label
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 font-mono text-[10px]">
              &gt;48H CAP
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: Surface Tokens & Interactive Edge/Recovery Triggers */}
      <section className="rounded-2xl bg-[#0D1117] border border-slate-800/90 p-5 space-y-4">
        <h2 className="font-display font-bold text-base text-slate-100">
          2. Interactive Edge Cases, Guardrails & Multi-Step Journey Launchers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-[#151B24] border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-display font-bold text-xs text-slate-100">
                Journey 1: Coverage Gap Resolution
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Inspect Sun 25 Oct 3RD · Night gap, compare Sofia Reyes (eligible) vs Marcus Chen (&lt;11h rest), stage & publish.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveWorkspace('schedule');
                setSupportingPanel({
                  kind: 'coverage_gap',
                  entityId: 'GAP-2026-1025-N',
                  widthPx: 440
                });
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#06B6D4] text-slate-950 font-semibold text-xs"
            >
              Launch Gap Finder
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#151B24] border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-display font-bold text-xs text-slate-100">
                Journey 2: Leave Approval → Roster Update
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Approve Priya Nair's Tue 27 Oct leave request (`LR-2026-109`), stage replacement, and publish.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveWorkspace('requests');
                setSupportingPanel({
                  kind: 'leave_request',
                  entityId: 'LR-2026-109',
                  widthPx: 430
                });
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#10B981] text-slate-950 font-semibold text-xs"
            >
              Launch Leave Review
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#151B24] border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-display font-bold text-xs text-slate-100">
                Journey 3: Autonomous Week Autopilot
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Generate isolated proposal for Next Week (`26 Oct–1 Nov 2026`), inspect cell diffs, and apply to Draft.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveWorkspace('schedule');
                generateAIAutopilotProposal('scope-2026-10-26');
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#818CF8] text-slate-950 font-semibold text-xs"
            >
              Launch Week Autopilot
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#151B24] border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-display font-bold text-xs text-slate-100">
                Edge Case: Concurrent Edit Conflict
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Simulate another supervisor publishing `v2.5-remote` while you have local edits and resolve side-by-side.
              </p>
            </div>
            <button
              onClick={() => triggerSimulatedConflict()}
              className="w-full py-2 px-3 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-200 font-semibold text-xs"
            >
              Simulate Conflict
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
