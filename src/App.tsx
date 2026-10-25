import React, { useState } from 'react';
import {
  LayoutDashboard,
  AlertCircle,
  Calendar,
  Radar,
  ArrowLeftRight,
  ShieldAlert,
  Users,
  Shield,
  Layers,
  Search,
  Bell,
  Clock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  Sliders,
  CheckCircle2,
  X
} from 'lucide-react';
import { ShiftSyncProvider, useShiftSync } from './context/ShiftSyncContext';
import { PERSONAS } from './data/shiftSyncSeed';
import { WorkspaceId, PersonaId } from './data/shiftSyncTypes';
import { SupportingPanel } from './components/SupportingPanel';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import {
  OverviewWorkspace,
  NeedsAttentionWorkspace
} from './workspaces/OverviewAndAttentionWorkspaces';
import { ScheduleWorkspace } from './workspaces/ScheduleWorkspace';
import {
  LiveFloorRadarWorkspace,
  OperatorDossiersWorkspace
} from './workspaces/LiveFloorAndOperatorsWorkspaces';
import {
  LeavesAndTradesWorkspace,
  IncidentsAndHandoverWorkspace
} from './workspaces/LeavesAndIncidentsWorkspaces';
import {
  AdminGuardianWorkspace,
  ComponentStateBoardWorkspace
} from './workspaces/AdminAndBoardWorkspaces';

const ShiftSyncShell: React.FC = () => {
  const {
    activePersonaId,
    activePersona,
    setActivePersonaId,
    demoNowIso,
    setDemoNowIso,
    activeWorkspace,
    setActiveWorkspace,
    activeScope,
    sidebarCollapsed,
    setSidebarCollapsed,
    density,
    setDensity,
    highContrast,
    setHighContrast,
    setCommandPaletteOpen,
    coverageGaps,
    leaveRequests,
    shiftTrades,
    incidents,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    resetDemoState,
    toastMessage,
    dismissToast
  } = useShiftSync();

  const [notifOpen, setNotifOpen] = useState(false);

  const pendingApprovalsCount =
    leaveRequests.filter((l) => l.status === 'Pending Approval').length +
    shiftTrades.filter((t) => t.status === 'Supervisor Review').length;
  const openIncidentsCount = incidents.filter((i) => i.status !== 'Resolved').length;
  const needsAttentionCount = coverageGaps.length + pendingApprovalsCount + openIncidentsCount;
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const navItems: {
    id: WorkspaceId;
    label: string;
    shortLabel: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: 'overview',
      label: 'Overview',
      shortLabel: 'Overview',
      icon: LayoutDashboard
    },
    {
      id: 'needs_attention',
      label: 'Needs attention',
      shortLabel: 'Alerts',
      icon: AlertCircle,
      badge: needsAttentionCount
    },
    {
      id: 'schedule',
      label: 'Schedule',
      shortLabel: 'Schedule',
      icon: Calendar
    },
    {
      id: 'live_floor',
      label: 'Live Floor',
      shortLabel: 'Floor',
      icon: Radar
    },
    {
      id: 'requests',
      label: 'Requests',
      shortLabel: 'Requests',
      icon: ArrowLeftRight,
      badge: pendingApprovalsCount
    },
    {
      id: 'incidents',
      label: 'Incidents & Handover',
      shortLabel: 'Incidents',
      icon: ShieldAlert,
      badge: openIncidentsCount
    },
    {
      id: 'operators',
      label: 'Operators',
      shortLabel: 'Operators',
      icon: Users
    },
    {
      id: 'administration',
      label: 'Administration',
      shortLabel: 'Admin',
      icon: Shield
    },
    {
      id: 'component_board',
      label: 'Component & State Board',
      shortLabel: 'Verify',
      icon: Layers
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col selection:bg-[#06B6D4]/30 selection:text-[#22D3EE]">
      {/* 56px Global Top Bar (§6) */}
      <header className="h-14 sticky top-0 z-[250] bg-[#0D1117]/95 backdrop-blur-md border-b border-slate-800/90 px-4 flex items-center justify-between gap-3">
        {/* Left: Brand Identity + Active Workspace Breadcrumb + Scope Status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setActiveWorkspace('overview')}
            className="flex items-center gap-2.5 text-left focus:outline-none group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#10B981] flex items-center justify-center font-mono font-bold text-slate-950 text-xs shadow-md shadow-[#06B6D4]/20">
              SS
            </div>
            <div className="hidden sm:block">
              <div className="font-display font-bold text-sm text-slate-100 leading-none flex items-center gap-1.5">
                <span>ShiftSync AI</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[#22D3EE]">
                  {activeScope.version}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                24/7 Operations HUD · {activeScope.status}
              </div>
            </div>
          </button>

          <span className="text-slate-700 hidden md:inline">/</span>

          {/* Demo Clock Selector (Fixed Default: 25 Oct 2026 14:00 IST / 08:30 UTC) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#151B24] border border-slate-800 font-mono text-xs text-slate-200">
            <Clock className="w-3.5 h-3.5 text-[#06B6D4]" />
            <select
              aria-label="Demonstration reference time in Asia/Kolkata"
              value={demoNowIso}
              onChange={(e) => setDemoNowIso(e.target.value)}
              className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="2026-10-25T14:00:00+05:30">
                Sun 25 Oct 2026 · 14:00 IST (08:30 UTC) · Overlap
              </option>
              <option value="2026-10-25T09:30:00+05:30">
                Sun 25 Oct 2026 · 09:30 IST (04:00 UTC) · 1ST Day
              </option>
              <option value="2026-10-25T21:15:00+05:30">
                Sun 25 Oct 2026 · 21:15 IST (15:45 UTC) · 3RD Night
              </option>
            </select>
          </div>
        </div>

        {/* Center: Global Search / Command Palette Trigger (Ctrl/Cmd + K) */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex-1 max-w-md px-3 py-1.5 rounded-xl bg-[#151B24] hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 flex items-center justify-between gap-2 transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
            <span className="truncate">
              Search operators (#OP-4092), shifts, zones, or commands...
            </span>
          </span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-300 shrink-0">
            ⌘K
          </kbd>
        </button>

        {/* Right: Density, Contrast, Reset Demo, Notifications, Acting Persona Switcher */}
        <div className="flex items-center gap-2">
          {/* Density Toggle */}
          <button
            onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
            title={`Switch roster density (Currently: ${density})`}
            className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#151B24] hover:bg-slate-800 border border-slate-800 font-mono text-[11px] text-slate-300"
          >
            <Sliders className="w-3 h-3 text-[#06B6D4]" />
            <span className="capitalize">{density}</span>
          </button>

          {/* High Contrast Toggle */}
          <button
            onClick={() => setHighContrast(!highContrast)}
            title="Toggle High Contrast accessibility mode"
            aria-pressed={highContrast}
            className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-mono text-[11px] transition-colors ${
              highContrast
                ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#22D3EE] font-bold'
                : 'bg-[#151B24] border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>HC</span>
          </button>

          {/* Reset Demo Action */}
          <button
            onClick={resetDemoState}
            title="Reset demo state to Sunday 25 Oct 2026 14:00 IST baseline"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#151B24] hover:bg-slate-800 border border-slate-800 font-mono text-[11px] text-slate-300"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Reset</span>
          </button>

          {/* Notification Center */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              aria-label={`Notifications (${unreadNotifCount} unread)`}
              className="p-2 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-800 text-slate-200 relative"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#06B6D4] text-slate-950 font-mono text-[10px] font-bold flex items-center justify-center absolute -top-1 -right-1">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#0D1117] border border-slate-700 shadow-2xl p-3 z-[300] space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-display font-bold text-xs text-slate-100">
                    Operations Notifications
                  </span>
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-[11px] text-[#22D3EE] hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1.5">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.linkWorkspace) setActiveWorkspace(n.linkWorkspace);
                        setNotifOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                        n.read
                          ? 'bg-[#151B24]/40 border-slate-800/70 text-slate-400'
                          : 'bg-[#151B24] border-[#06B6D4]/40 text-slate-100'
                      }`}
                    >
                      <div className="font-display font-semibold text-xs">{n.title}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{n.body}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Acting Persona Switcher (§7: Alex Morgan, Priya Nair, Elena Petrova) */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <select
              aria-label="Switch acting demonstration persona and role"
              value={activePersonaId}
              onChange={(e) => setActivePersonaId(e.target.value as PersonaId)}
              className="px-2.5 py-1.5 rounded-xl bg-[#151B24] border border-[#06B6D4]/50 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#06B6D4] cursor-pointer"
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.permissionRole} ({p.badgeCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Body: Left Sidebar + Primary Workspace + Contextual Supporting Panel */}
      <div className="flex-1 flex min-h-[calc(100vh-3.5rem)] relative">
        {/* Left Collapsible Navigation Sidebar (§6) */}
        <aside
          aria-label="Primary Workspace Navigation"
          className={`${
            sidebarCollapsed ? 'w-16' : 'w-60'
          } shrink-0 bg-[#0D1117] border-r border-slate-800/90 flex flex-col justify-between transition-all duration-200 select-none`}
        >
          <nav className="p-2.5 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeWorkspace === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveWorkspace(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#06B6D4]/15 text-[#22D3EE] border border-[#06B6D4]/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#151B24]/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#22D3EE]' : 'text-slate-400'
                      }`}
                    />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-bold ${
                        isActive
                          ? 'bg-[#06B6D4] text-slate-950'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer: Shift Legend Summary & Collapse Toggle */}
          <div className="p-2.5 border-t border-slate-800/80 space-y-2">
            {!sidebarCollapsed && (
              <div className="p-2.5 rounded-xl bg-[#151B24]/70 border border-slate-800/80 space-y-1.5 text-[11px] font-mono">
                <div className="text-slate-400 uppercase text-[10px]">Default Shift Windows</div>
                <div className="flex items-center justify-between text-[#22D3EE]">
                  <span>1ST · Day</span>
                  <span>07:30–16:30</span>
                </div>
                <div className="flex items-center justify-between text-[#34D399]">
                  <span>2ND · Swing</span>
                  <span>12:30–20:30</span>
                </div>
                <div className="flex items-center justify-between text-[#A5B4FC]">
                  <span>3RD · Night</span>
                  <span>20:30–07:30</span>
                </div>
                <div className="flex items-center justify-between text-[#FBBF24]">
                  <span>GEN · General</span>
                  <span>09:00–18:00</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="w-full py-2 px-3 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-2 transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Collapse Sidebar</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Primary Workspace Canvas */}
        <main className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
          {activeWorkspace === 'overview' && <OverviewWorkspace />}
          {activeWorkspace === 'needs_attention' && <NeedsAttentionWorkspace />}
          {activeWorkspace === 'schedule' && <ScheduleWorkspace />}
          {activeWorkspace === 'live_floor' && <LiveFloorRadarWorkspace />}
          {activeWorkspace === 'requests' && <LeavesAndTradesWorkspace />}
          {activeWorkspace === 'incidents' && <IncidentsAndHandoverWorkspace />}
          {activeWorkspace === 'operators' && <OperatorDossiersWorkspace />}
          {activeWorkspace === 'administration' && <AdminGuardianWorkspace />}
          {activeWorkspace === 'component_board' && <ComponentStateBoardWorkspace />}
        </main>

        {/* Contextual Supporting Panel (§21) */}
        <SupportingPanel />
      </div>

      {/* Global Command Palette Modal (Ctrl/Cmd + K) */}
      <GlobalCommandPalette />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[500] max-w-md rounded-2xl bg-[#0D1117]/95 backdrop-blur-xl border border-[#06B6D4]/60 shadow-2xl p-4 flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-[#22D3EE] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-xs text-slate-100">
              {toastMessage.title}
            </div>
            {toastMessage.detail && (
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {toastMessage.detail}
              </p>
            )}
          </div>
          <button
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export function App() {
  return (
    <ShiftSyncProvider>
      <ShiftSyncShell />
    </ShiftSyncProvider>
  );
}

export default App;
