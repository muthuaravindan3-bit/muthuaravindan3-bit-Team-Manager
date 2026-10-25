import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  User,
  Calendar,
  AlertTriangle,
  Sparkles,
  Radar,
  Shield,
  Sliders,
  X,
  ArrowRight
} from 'lucide-react';
import { useShiftSync } from '../context/ShiftSyncContext';
import { WorkspaceId } from '../data/shiftSyncTypes';

export const GlobalCommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    operators,
    incidents,
    leaveRequests,
    shiftTrades,
    setActiveWorkspace,
    setScheduleSubView,
    setSupportingPanel,
    generateAIAutopilotProposal,
    resetDemoState,
    setDensity,
    density,
    highContrast,
    setHighContrast
  } = useShiftSync();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [commandPaletteOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const commands = [
      {
        id: 'cmd-autopilot',
        category: 'AI & Scheduling Actions',
        title: 'Run Autonomous Week Autopilot (26 Oct–1 Nov 2026)',
        subtitle: 'Generate isolated proposal for next week with 0 turnaround violations',
        action: () => {
          setActiveWorkspace('schedule');
          generateAIAutopilotProposal('scope-2026-10-26');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-gap',
        category: 'AI & Scheduling Actions',
        title: 'Resolve Open Night Shift Coverage Gap (GAP-2026-1025-N)',
        subtitle: 'Compare replacement candidates (Sofia Reyes, Marcus Chen, Devansh Mehta)',
        action: () => {
          setActiveWorkspace('schedule');
          setSupportingPanel({ kind: 'coverage_gap', entityId: 'GAP-2026-1025-N', widthPx: 440 });
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-ws-overview',
        category: 'Workspaces',
        title: 'Go to Overview (Command Center)',
        subtitle: 'Role-tailored operational KPIs, Orbital Chrono-Ring, and Alert Desk',
        action: () => {
          setActiveWorkspace('overview');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-ws-attention',
        category: 'Workspaces',
        title: 'Go to Needs Attention (Action Center)',
        subtitle: 'Grouped coverage gaps, turnaround alerts, pending requests, and incidents',
        action: () => {
          setActiveWorkspace('needs_attention');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-ws-schedule',
        category: 'Workspaces',
        title: 'Go to Schedule & Roster',
        subtitle: 'Roster Table, Week Grid, Coverage Matrix, and 24h Timeline',
        action: () => {
          setActiveWorkspace('schedule');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-ws-timeline',
        category: 'Workspaces',
        title: 'Open 24h Timeline & Handover Overlap (12:30–16:30)',
        subtitle: 'Inspect 1ST · Day, 2ND · Swing, 3RD · Night, and GEN · General coverage',
        action: () => {
          setActiveWorkspace('schedule');
          setScheduleSubView('timeline_24h');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-ws-radar',
        category: 'Workspaces',
        title: 'Go to Live Floor Radar',
        subtitle: 'Interactive facility sector map and accessible station list',
        action: () => {
          setActiveWorkspace('live_floor');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-ws-requests',
        category: 'Workspaces',
        title: 'Go to Leaves & Trades',
        subtitle: 'Approve Priya Nair leave request or Marcus Chen / James Okafor shift trade',
        action: () => {
          setActiveWorkspace('requests');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-ws-incidents',
        category: 'Workspaces',
        title: 'Go to Incidents & Handover',
        subtitle: 'Mitigate active incidents and sign off Day-to-Swing shift handover',
        action: () => {
          setActiveWorkspace('incidents');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-ws-board',
        category: 'Verification & Settings',
        title: 'Open Component & State Verification Board (§23)',
        subtitle: 'Inspect all shift tokens, density modes, high contrast, and recovery states',
        action: () => {
          setActiveWorkspace('component_board');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-density',
        category: 'Verification & Settings',
        title: `Toggle Density Mode (Currently: ${density})`,
        subtitle: 'Switch between Comfortable and Compact roster density',
        action: () => {
          setDensity(density === 'comfortable' ? 'compact' : 'comfortable');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-contrast',
        category: 'Verification & Settings',
        title: `Toggle High Contrast Mode (Currently: ${highContrast ? 'ON' : 'OFF'})`,
        subtitle: 'Boost border visibility and text contrast across all workspaces',
        action: () => {
          setHighContrast(!highContrast);
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'cmd-reset',
        category: 'Verification & Settings',
        title: 'Reset Demo State to Baseline (v2.4)',
        subtitle: 'Restore Sunday 25 Oct 2026 14:00 IST initial seeded state',
        action: () => {
          resetDemoState();
          setCommandPaletteOpen(false);
        }
      }
    ];

    const operatorItems = operators.map((op) => ({
      id: `op-${op.id}`,
      category: 'Operators (#OP-XXXX)',
      title: `${op.name} (${op.badgeCode})`,
      subtitle: `${op.jobTitle} · ${op.zone} · Certs: ${op.certifications.join(', ')}`,
      action: () => {
        setSupportingPanel({ kind: 'operator_dossier', entityId: op.id, widthPx: 430 });
        setCommandPaletteOpen(false);
      }
    }));

    const incidentItems = incidents.map((inc) => ({
      id: `inc-${inc.id}`,
      category: 'Incidents',
      title: `${inc.id} · ${inc.title}`,
      subtitle: `${inc.severity} · ${inc.status} · ${inc.zone}`,
      action: () => {
        setActiveWorkspace('incidents');
        setSupportingPanel({ kind: 'incident_detail', entityId: inc.id, widthPx: 430 });
        setCommandPaletteOpen(false);
      }
    }));

    const requestItems = [
      ...leaveRequests.map((lr) => ({
        id: `lr-${lr.id}`,
        category: 'Requests & Trades',
        title: `${lr.id} · Leave Request (${lr.startDate})`,
        subtitle: `${lr.leaveType} · ${lr.status}`,
        action: () => {
          setActiveWorkspace('requests');
          setSupportingPanel({ kind: 'leave_request', entityId: lr.id, widthPx: 430 });
          setCommandPaletteOpen(false);
        }
      })),
      ...shiftTrades.map((tr) => ({
        id: `tr-${tr.id}`,
        category: 'Requests & Trades',
        title: `${tr.id} · Shift Trade (${tr.requesterDate})`,
        subtitle: `${tr.requesterShift} ↔ ${tr.partnerShift} · ${tr.status}`,
        action: () => {
          setActiveWorkspace('requests');
          setSupportingPanel({ kind: 'shift_trade', entityId: tr.id, widthPx: 430 });
          setCommandPaletteOpen(false);
        }
      }))
    ];

    const all = [...commands, ...operatorItems, ...incidentItems, ...requestItems];
    if (!q) return all.slice(0, 14);
    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [
    query,
    operators,
    incidents,
    leaveRequests,
    shiftTrades,
    density,
    highContrast,
    setActiveWorkspace,
    setScheduleSubView,
    setSupportingPanel,
    generateAIAutopilotProposal,
    setCommandPaletteOpen,
    setDensity,
    setHighContrast,
    resetDemoState
  ]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette and Search"
      className="fixed inset-0 z-[400] bg-slate-950/75 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#0D1117] border border-slate-700/80 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-[#151B24]/80">
          <Search className="w-4 h-4 text-[#06B6D4] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search operators (#OP-4092), zones, incidents, shift presets, or run commands..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-400">
            ESC
          </kbd>
          <button
            onClick={() => setCommandPaletteOpen(false)}
            aria-label="Close command palette"
            className="p-1 text-slate-400 hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2 divide-y divide-slate-800/50">
          {results.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="font-display font-semibold text-slate-200 text-sm">
                No matching operators, shifts, or commands
              </div>
              <p className="text-xs text-slate-400">
                Try searching for "#OP-4092", "Sofia", "Autopilot", "Night", or "Handover".
              </p>
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full px-3 py-2.5 text-left rounded-xl hover:bg-[#151B24] transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#22D3EE]">
                    {item.category}
                  </div>
                  <div className="font-display font-semibold text-sm text-slate-100 truncate mt-0.5">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#22D3EE] shrink-0 transition-colors" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
