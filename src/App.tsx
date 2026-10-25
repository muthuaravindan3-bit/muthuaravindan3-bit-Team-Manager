import React, { useState, useEffect } from 'react';
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
  X,
  Compass,
  Play,
  Sparkles,
  ArrowRight,
  Check,
  Menu
} from 'lucide-react';
import { ShiftSyncProvider, useShiftSync } from './context/ShiftSyncContext';
import { PERSONAS } from './data/shiftSyncSeed';
import { WorkspaceId, PersonaId } from './data/shiftSyncTypes';
import { SupportingPanel } from './components/SupportingPanel';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import { buildAttentionQueue } from './utils/attentionQueue';
import { useDialogFocus } from './hooks/useDialogFocus';
import { LocalStatus } from './components/LocalStatus';
import { WorkspaceBoundary } from './components/WorkspaceBoundary';
import { publishedAssignments } from './services/operationalSelectors';
import { staffingAt } from './services/schedulingPolicy';
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
    scopes,
    rulesConfig,
    activeValidation,
    operators,
    leaveRequests,
    shiftTrades,
    incidents,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    resetDemoState,
    toastMessage,
    dismissToast,
    setSupportingPanel,
    setActiveScopeId,
    setLeavesSubView,
    setIncidentsSubView,
    generateAIAutopilotProposal,
    showToast,
    approveLeaveRequest,
    assignReplacementToGap,
    publishScheduleScope,
    resolveIncident,
    sealShiftHandover,
    applyAIProposalToDraft,
    approveAndExecuteShiftTrade,
    closeSupportingPanel,
    updateIncidentOutcomeNote,
    toggleIncidentStep,
    updateHandoverSession,
    setScheduleSubView
  } = useShiftSync();

  const [facility, setFacility] = useState('BLR · Primary Operations Facility');
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useDialogFocus(mobileMenuOpen);
  useEffect(() => { setMobileMenuOpen(false); }, [activeWorkspace]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);
  const [journeysModalOpen, setJourneysModalOpen] = useState(false);
  const [activeFlowId, setActiveFlowId] = useState<number | null>(null);
  const [showFlowHud, setShowFlowHud] = useState<boolean>(false);
  const helpRef = useDialogFocus<HTMLDivElement>(helpOpen);
  const settingsRef = useDialogFocus<HTMLDivElement>(settingsOpen);
  const journeysRef = useDialogFocus<HTMLDivElement>(journeysModalOpen);
  useEffect(() => {
    const closeModal = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (journeysModalOpen) setJourneysModalOpen(false);
      else if (settingsOpen) setSettingsOpen(false);
      else if (helpOpen) setHelpOpen(false);
    };
    window.addEventListener('keydown', closeModal); return () => window.removeEventListener('keydown', closeModal);
  }, [journeysModalOpen, settingsOpen, helpOpen]);

  const needsAttentionCount = buildAttentionQueue({ coverageGaps, leaveRequests, shiftTrades, incidents, issues: activeValidation.issues, operators }).filter((item) => item.status === 'open').length;
  const pendingApprovalsCount =
    leaveRequests.filter((l) => l.status === 'Pending Approval').length +
    shiftTrades.filter((t) => t.status === 'Supervisor Review').length;
  const openIncidentsCount = incidents.filter((i) => i.status !== 'Resolved').length;
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const flowsMeta = [
    {
      id: 1,
      title: 'Coverage Gap to Publication',
      section: '§24.1',
      step: 'Inspect Sofia Reyes (calculated rest) → Click "Apply Sofia Reyes" → "Review & Publish v2.5"',
      actionLabel: 'Review Coverage Workflow',
      color: '#06B6D4'
    },
    {
      id: 2,
      title: 'Leave Request to Updated Schedule',
      section: '§24.2',
      step: 'Inspect Priya Nair LR-2026-109 → Click "Approve Leave Request" → Stage WO in draft',
      actionLabel: 'Review Leave Workflow',
      color: '#10B981'
    },
    {
      id: 3,
      title: 'Incident Runbook to Handover Seal',
      section: '§24.3',
      step: 'Complete INC-2026-841 checklist → Document outcome → Resolve → Seal Day-to-Swing Handover',
      actionLabel: 'Review Incident & Handover',
      color: '#F59E0B'
    },
    {
      id: 4,
      title: 'Autonomous Week Autopilot',
      section: '§24.4',
      step: 'Target 26 Oct–1 Nov 2026 → Inspect constraints and coverage proposal → Apply to draft → Publish v3.0',
      actionLabel: 'Review AI Suggestion',
      color: '#818CF8'
    },
    {
      id: 5,
      title: 'Shift Trade Atomic Swap',
      section: '§24.5',
      step: 'Trade TR-2026-304 (Marcus Chen ⇄ Elena Petrova) → Verify turnaround → Approve & stage atomically',
      actionLabel: 'Review Trade Workflow',
      color: '#06B6D4'
    }
  ];

  const launchJourney1 = () => {
    setActiveFlowId(1);
    setShowFlowHud(true);
    setActivePersonaId('shift_lead');
    setActiveWorkspace('needs_attention');
    setSupportingPanel({
      kind: 'coverage_gap',
      entityId: 'GAP-2026-1025-N',
      widthPx: 480
    });
    setJourneysModalOpen(false);
    showToast(
      'Flow 1: Coverage Gap → Publication Activated',
      'Inspect Sofia Reyes (calculated rest). Click "Apply Sofia Reyes", then click "Review & Publish v2.5".',
      'cyan'
    );
  };

  const launchJourney2 = () => {
    setActiveFlowId(2);
    setShowFlowHud(true);
    setActivePersonaId('shift_lead');
    setActiveWorkspace('requests');
    setLeavesSubView('requests');
    setSupportingPanel({
      kind: 'leave_request',
      entityId: 'LR-2026-109',
      widthPx: 430
    });
    setJourneysModalOpen(false);
    showToast(
      'Flow 2: Leave Request → Schedule Update Activated',
      'Review Priya Nair’s leave. Click "Approve & Plan Coverage" to stage linked draft change to WO.',
      'emerald'
    );
  };

  const launchJourney3 = () => {
    setActiveFlowId(3);
    setShowFlowHud(true);
    setActivePersonaId('shift_lead');
    setActiveWorkspace('incidents');
    setIncidentsSubView('incidents');
    setSupportingPanel({
      kind: 'incident_detail',
      entityId: 'INC-2026-841',
      widthPx: 450
    });
    setJourneysModalOpen(false);
    showToast(
      'Flow 3: Incident Runbook & Handover Seal Activated',
      'Complete checklist steps, add outcome note, mark resolved, then click Handover tab to seal sign-off.',
      'amber'
    );
  };

  const launchJourney4 = () => {
    setActiveFlowId(4);
    setShowFlowHud(true);
    setActivePersonaId('shift_lead');
    setActiveWorkspace('schedule');
    setActiveScopeId('scope-2026-10-26');
    generateAIAutopilotProposal('scope-2026-10-26');
    setJourneysModalOpen(false);
    showToast(
      'Flow 4: Autonomous Week Autopilot Activated',
      'AI Proposal generated for 26 Oct–1 Nov 2026. Inspect 96% equity, 0 turnaround violations, and click "Apply to Draft".',
      'cyan'
    );
  };

  const launchJourney5 = () => {
    setActiveFlowId(5);
    setShowFlowHud(true);
    setActivePersonaId('shift_lead');
    setActiveWorkspace('requests');
    setLeavesSubView('shift_trades');
    setSupportingPanel({
      kind: 'shift_trade',
      entityId: 'TR-2026-304',
      widthPx: 460
    });
    setJourneysModalOpen(false);
    showToast(
      'Flow 5: Shift Trade Atomic Swap Activated',
      'Inspect mutual shift trade between Marcus Chen (2ND) and Elena Petrova (GEN). Click "Approve Trade & Apply Both Shifts".',
      'cyan'
    );
  };

  const launchJourney = (id: number) => {
    if (id === 1) launchJourney1();
    else if (id === 2) launchJourney2();
    else if (id === 3) launchJourney3();
    else if (id === 4) launchJourney4();
    else if (id === 5) launchJourney5();
  };

  const startNextFlow = () => {
    const nextId = activeFlowId ? (activeFlowId % 5) + 1 : 2;
    launchJourney(nextId);
  };

  const executeCurrentFlowStep = () => { if (activeFlowId) launchJourney(activeFlowId); };

  const mainNavItems = [
    {
      id: 'overview' as WorkspaceId,
      label: 'Overview',
      icon: LayoutDashboard
    },
    {
      id: 'needs_attention' as WorkspaceId,
      label: 'Needs attention',
      icon: AlertCircle,
      badge: needsAttentionCount
    }
  ];

  const operationsNavItems = [
    {
      id: 'schedule' as WorkspaceId,
      label: 'Schedule',
      icon: Calendar
    },
    {
      id: 'live_floor' as WorkspaceId,
      label: 'Live Floor',
      icon: Radar
    },
    {
      id: 'requests' as WorkspaceId,
      label: 'Requests',
      icon: ArrowLeftRight,
      badge: pendingApprovalsCount
    },
    {
      id: 'incidents' as WorkspaceId,
      label: 'Incidents & Handover',
      icon: ShieldAlert,
      badge: openIncidentsCount
    }
  ];

  const peopleNavItems = [
    {
      id: 'operators' as WorkspaceId,
      label: 'Operators',
      icon: Users
    }
  ];

  const managementNavItems = [
    {
      id: 'administration' as WorkspaceId,
      label: 'Administration',
      icon: Shield
    },
    {
      id: 'component_board' as WorkspaceId,
      label: 'Component & State Board',
      icon: Layers
    }
  ];

  return (
    <div className="shiftsync-shell min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col selection:bg-[#06B6D4]/30 selection:text-[#22D3EE]">
      <a className="skip-to-workspace" href="#workspace">Skip to workspace</a>
      {/* 56px Global Top Bar (§4 & §6) */}
      <header className="h-14 sticky top-0 z-[250] bg-[#0D1117]/95 backdrop-blur-md border-b border-slate-800/90 px-4 flex items-center justify-between gap-3">
        {/* Left: Hexagonal Logo + ShiftSync AI Wordmark + Compact Operational Status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setActiveWorkspace('overview')}
            aria-label="ShiftSync overview"
            className="flex items-center gap-2.5 text-left focus:outline-none group shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#10B981] flex items-center justify-center font-mono font-bold text-slate-950 text-xs shadow-md shadow-[#06B6D4]/20">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-slate-950">
                <polygon points="12,2 22,7 22,17 12,22 2,17 2,7" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <div className="font-display font-bold text-sm text-slate-100 leading-none flex items-center gap-1.5">
                <span>ShiftSync AI</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[#22D3EE]">
                  {activeScope.version}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{staffingAt(publishedAssignments(scopes), operators, Date.parse(demoNowIso), undefined, undefined, true)} present · Local demo</span>
              </div>
            </div>
          </button>

          <span className="text-slate-700 hidden md:inline">/</span>

          {/* Dual Local & UTC Clocks (§6: Asia/Kolkata 14:00 IST / 08:30 UTC) */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#151B24] border border-slate-800 font-mono text-xs text-slate-200">
            <Clock className="w-3.5 h-3.5 text-[#06B6D4]" />
            <select
              aria-label="Demonstration reference time in Asia/Kolkata"
              value={demoNowIso}
              onChange={(e) => setDemoNowIso(e.target.value)}
              className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="2026-10-25T14:00:00+05:30">
                14:00 IST / 08:30 UTC · Day/Swing Overlap
              </option>
              <option value="2026-10-25T09:30:00+05:30">
                09:30 IST / 04:00 UTC · 1ST Day Watch
              </option>
              <option value="2026-10-25T21:15:00+05:30">
                21:15 IST / 15:45 UTC · 3RD Night Watch
              </option>
            </select>
          </div>
        </div>

        {/* Center: Global Search / Command Palette Trigger (Ctrl/Cmd + K) */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Search operators, shifts, zones, or commands"
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
          <button className="attention-button" aria-label="Appearance and demonstration clock" onClick={() => setSettingsOpen(true)}><Sliders size={16} /><span className="hidden md:inline">Appearance</span></button>
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

          {/* Guided Journeys / Start Flow Button (§24) */}
          <button
            onClick={() => setJourneysModalOpen(true)}
            title="Launch Guided Flows for all 5 specification journeys"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#06B6D4]/25 via-[#06B6D4]/15 to-[#818CF8]/25 hover:from-[#06B6D4]/35 hover:to-[#818CF8]/35 border border-[#06B6D4]/60 text-xs font-semibold text-[#22D3EE] transition-all shadow-sm"
          >
            <Compass className="w-3.5 h-3.5 text-[#22D3EE]" />
            <span className="font-display">Start Flow</span>
            <span className="px-1.5 py-0.2 rounded-md bg-[#06B6D4] text-slate-950 font-mono text-[10px] font-bold">
              5
            </span>
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

          {/* Acting Persona Switcher (§5: Alex Morgan, Priya Nair, Elena Petrova) */}
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

      {/* Main Body: Left Sidebar (§4) + Primary Workspace + Contextual Supporting Panel */}
      <div className="flex-1 flex min-h-[calc(100vh-3.5rem)] relative">
        {/* Left Collapsible Navigation Sidebar (§4) */}
        {mobileMenuOpen && <button className="mobile-navigation-backdrop" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}
        <aside
          ref={mobileMenuRef}
          role={mobileMenuOpen ? 'dialog' : undefined}
          aria-modal={mobileMenuOpen ? true : undefined}
          tabIndex={mobileMenuOpen ? -1 : undefined}
          aria-label="Primary Workspace Navigation"
          data-mobile-open={mobileMenuOpen}
          className={`${
            sidebarCollapsed ? 'w-16' : 'w-60'
          } shrink-0 bg-[#0D1117] border-r border-slate-800/90 flex flex-col justify-between select-none`}
        >
          <div className="p-2.5 space-y-3 overflow-y-auto">
            <button className="mobile-navigation-close attention-button" onClick={() => setMobileMenuOpen(false)}>Close navigation <X size={20} /></button>
            <button className="mobile-navigation-close attention-button" onClick={() => { setMobileMenuOpen(false); setJourneysModalOpen(true); }}>Explore guided flows <Compass size={20} /></button>
            {/* Facility / Workspace Selector (§4) */}
            {!sidebarCollapsed ? (
              <div className="p-2 rounded-xl bg-[#151B24] border border-slate-800 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Facility Workspace
                </div>
                <select
                  aria-label="Select facility workspace"
                  value={facility}
                  onChange={(e) => setFacility(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-[#22D3EE] focus:outline-none cursor-pointer truncate"
                >
                  <option value="BLR · Primary Operations Facility">BLR · Primary Facility</option>
                  <option value="HYD · Secondary Grid Complex">HYD · Secondary Complex</option>
                </select>
              </div>
            ) : (
              <div
                title={facility}
                className="w-10 h-10 mx-auto rounded-xl bg-[#151B24] border border-slate-800 flex items-center justify-center font-mono text-xs font-bold text-[#22D3EE]"
              >
                BLR
              </div>
            )}

            {/* Main Section */}
            <nav className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeWorkspace === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setMobileMenuOpen(false); setActiveWorkspace(item.id); }}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
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

            {/* OPERATIONS Section */}
            <div className="space-y-1 pt-1">
              {!sidebarCollapsed && (
                <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Operations
                </div>
              )}
              {operationsNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeWorkspace === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setMobileMenuOpen(false); setActiveWorkspace(item.id); }}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
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
            </div>

            {/* PEOPLE Section */}
            <div className="space-y-1 pt-1">
              {!sidebarCollapsed && (
                <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  People
                </div>
              )}
              {peopleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeWorkspace === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setMobileMenuOpen(false); setActiveWorkspace(item.id); }}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
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
                  </button>
                );
              })}
            </div>

            {/* MANAGEMENT Section */}
            <div className="space-y-1 pt-1">
              {!sidebarCollapsed && (
                <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Management
                </div>
              )}
              {managementNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeWorkspace === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setMobileMenuOpen(false); setActiveWorkspace(item.id); }}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
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
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar Footer: Shift Legend Summary, Shortcuts, Settings & Collapse Toggle (§4) */}
          <div className="p-2.5 border-t border-slate-800/80 space-y-2">
            {!sidebarCollapsed && (
              <div className="p-2.5 rounded-xl bg-[#151B24]/70 border border-slate-800/80 space-y-1.5 text-[11px] font-mono">
                <div className="text-slate-400 uppercase text-[10px]">Standard Shift Windows</div>
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

            {!sidebarCollapsed && (
              <div className="flex items-center justify-between px-2 text-xs text-slate-400">
                <button
                  onClick={() => { setMobileMenuOpen(false); setHelpOpen(true); }}
                  className="hover:text-slate-200 transition-colors"
                >
                  Help & Shortcuts
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); setSettingsOpen(true); }}
                  className="hover:text-slate-200 transition-colors"
                >
                  Settings
                </button>
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
        <main id="workspace" tabIndex={-1} className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
          <WorkspaceBoundary key={activeWorkspace}>
          <LocalStatus />
          {activeWorkspace === 'overview' && <OverviewWorkspace />}
          {activeWorkspace === 'needs_attention' && <NeedsAttentionWorkspace />}
          {activeWorkspace === 'schedule' && <ScheduleWorkspace />}
          {activeWorkspace === 'live_floor' && <LiveFloorRadarWorkspace />}
          {activeWorkspace === 'requests' && <LeavesAndTradesWorkspace />}
          {activeWorkspace === 'incidents' && <IncidentsAndHandoverWorkspace />}
          {activeWorkspace === 'operators' && <OperatorDossiersWorkspace />}
          {activeWorkspace === 'administration' && <AdminGuardianWorkspace />}
          {activeWorkspace === 'component_board' && <ComponentStateBoardWorkspace />}
          </WorkspaceBoundary>
        </main>

        {/* Contextual Supporting Panel (§21) */}
        <SupportingPanel />
      </div>
      <nav className="mobile-workspace-nav" aria-label="Mobile workspace navigation">
        {([
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'needs_attention', label: 'Attention', icon: AlertCircle },
          { id: 'schedule', label: 'Schedule', icon: Calendar },
          { id: 'requests', label: 'Requests', icon: ArrowLeftRight }
        ] as const).map((item) => <button key={item.id} aria-current={activeWorkspace === item.id ? 'page' : undefined} onClick={() => { setMobileMenuOpen(false); setActiveWorkspace(item.id); }}><item.icon size={20} /><span>{item.label}</span></button>)}
        <button aria-expanded={mobileMenuOpen} onClick={() => { setSidebarCollapsed(false); setMobileMenuOpen(!mobileMenuOpen); }}><Menu size={20} /><span>More</span></button>
      </nav>

      {/* Help & Keyboard Shortcuts Modal */}
      {helpOpen && (
        <div
          ref={helpRef}
          data-shell-modal="help"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[500] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#0D1117] border border-slate-700 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display font-bold text-base text-slate-100">
                Help & Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setHelpOpen(false)}
                aria-label="Close help"
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#151B24]">
                <span className="text-slate-300">Open Command Palette & Global Search</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[#22D3EE]">
                  ⌘K / Ctrl+K
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#151B24]">
                <span className="text-slate-300">Close Supporting Panel / Modals</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-slate-300">
                  ESC
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#151B24]">
                <span className="text-slate-300">Multi-Cell Roster Selection</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-slate-300">
                  Shift + Click
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#151B24]">
                <span className="text-slate-300">Toggle High Contrast Accessibility Mode</span>
                <span className="font-mono text-slate-400">Top Bar HC Button</span>
              </div>
            </div>
            <div className="pt-2 text-[11px] text-slate-400">
              ShiftSync AI version 2.4 · 24/7 Precision Operations HUD.
            </div>
          </div>
        </div>
      )}

      {/* Preferences & Display Settings Modal */}
      {settingsOpen && (
        <div
          ref={settingsRef}
          data-shell-modal="appearance"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[500] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#0D1117] border border-slate-700 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display font-bold text-base text-slate-100">
                Display & Application Settings
              </h3>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="Close appearance"
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <label className="block space-y-2">Demonstration clock · Asia/Kolkata<select aria-label="Demonstration clock" className="input-field" value={demoNowIso} onChange={(event) => setDemoNowIso(event.target.value)}><option value="2026-10-25T14:00:00+05:30">25 Oct · 14:00 IST / 08:30 UTC</option><option value="2026-10-25T09:30:00+05:30">25 Oct · 09:30 IST / 04:00 UTC</option><option value="2026-10-25T21:15:00+05:30">25 Oct · 21:15 IST / 15:45 UTC</option></select></label>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">Roster Display Density</div>
                  <div className="text-slate-400">Adjust table and cell spacing</div>
                </div>
                <div className="flex items-center gap-1 bg-[#151B24] p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setDensity('comfortable')}
                    className={`px-2.5 py-1 rounded text-xs capitalize ${
                      density === 'comfortable' ? 'bg-[#06B6D4] text-slate-950 font-bold' : 'text-slate-300'
                    }`}
                  >
                    Comfortable
                  </button>
                  <button
                    onClick={() => setDensity('compact')}
                    className={`px-2.5 py-1 rounded text-xs capitalize ${
                      density === 'compact' ? 'bg-[#06B6D4] text-slate-950 font-bold' : 'text-slate-300'
                    }`}
                  >
                    Compact
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200">High Contrast Mode</div>
                  <div className="text-slate-400">Boost border and token contrast</div>
                </div>
                <button
                  onClick={() => setHighContrast(!highContrast)}
                  className={`px-3 py-1.5 rounded-lg border font-mono text-xs ${
                    highContrast ? 'bg-[#06B6D4] text-slate-950 font-bold' : 'bg-[#151B24] border-slate-700 text-slate-200'
                  }`}
                >
                  {highContrast ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">Facility Timezone</div>
                  <div className="text-slate-400">Standard operational offset</div>
                </div>
                <span className="font-mono text-xs text-[#22D3EE]">Asia/Kolkata (+05:30)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guided Journeys Walkthrough Modal (§24) */}
      {journeysModalOpen && (
        <div
          ref={journeysRef}
          data-shell-modal="journeys"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setJourneysModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl my-8 rounded-2xl bg-[#0D1117] border border-[#06B6D4]/50 p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#06B6D4]/20 border border-[#06B6D4]/40 text-[#22D3EE]">
                    <Compass className="w-4 h-4 animate-spin-slow" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-slate-100">
                    Guided Operations Journeys · 5 Interactive Flows
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Compliance with §24 Specification. Select any flow to instantly stage personas, scopes, and context panels.
                </p>
              </div>
              <button
                onClick={() => setJourneysModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1"
                aria-label="Close guided flows modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Flows List */}
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {/* Flow 1 */}
              <div className="p-4 rounded-xl bg-[#151B24]/90 border border-slate-800 hover:border-[#06B6D4]/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#06B6D4]/20 text-[#22D3EE] font-mono text-[10px] font-bold">
                        FLOW 1 · §24.1
                      </span>
                      <h4 className="font-display font-bold text-sm text-slate-100">
                        Coverage Gap to Publication
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300">
                      Resolve Sector B Night Gap (<span className="font-mono text-[#818CF8]">GAP-2026-1025-N</span>) on Sun 25 Oct by comparing candidates. Assign <span className="text-[#22D3EE] font-semibold">Sofia Reyes</span> (calculated rest), validate 0 turnaround violations, and publish <span className="font-mono text-emerald-400">v2.5</span>.
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                      <span>• Target: Needs Attention</span>
                      <span>• Candidate: Sofia Reyes (#OP-4154)</span>
                      <span>• Scope: 19–25 Oct 2026</span>
                    </div>
                  </div>
                  <button
                    onClick={launchJourney1}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-slate-950 font-display font-bold text-xs shadow-md transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Launch Flow 1</span>
                  </button>
                </div>
              </div>

              {/* Flow 2 */}
              <div className="p-4 rounded-xl bg-[#151B24]/90 border border-slate-800 hover:border-emerald-500/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                        FLOW 2 · §24.2
                      </span>
                      <h4 className="font-display font-bold text-sm text-slate-100">
                        Leave Request to Updated Schedule
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300">
                      Priya Nair (<span className="font-mono text-slate-200">#OP-4092</span>) requested personal leave (<span className="font-mono text-emerald-400">LR-2026-109</span>) for Sun 25 Oct. Shift Lead approves request, staging draft assignment to <span className="font-mono text-slate-400">WO</span> with <span className="text-amber-400 font-semibold">Approved — schedule update pending</span>.
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                      <span>• Target: Requests Workspace</span>
                      <span>• Requester: Priya Nair</span>
                      <span>• Impact: 1 GEN shift</span>
                    </div>
                  </div>
                  <button
                    onClick={launchJourney2}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs shadow-md transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Launch Flow 2</span>
                  </button>
                </div>
              </div>

              {/* Flow 3 */}
              <div className="p-4 rounded-xl bg-[#151B24]/90 border border-slate-800 hover:border-amber-500/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
                        FLOW 3 · §24.3
                      </span>
                      <h4 className="font-display font-bold text-sm text-slate-100">
                        Incident Runbook to Handover Seal
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300">
                      Inspect incident <span className="font-mono text-amber-400">INC-2026-841</span> (Chilled Water Loop B, L2 Elevated). Complete troubleshooting checklist, document outcome note, mark resolved, and seal Day-to-Swing Handover with dual sign-off during the <span className="font-mono text-[#22D3EE]">12:30–16:30</span> overlap.
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                      <span>• Target: Incidents & Handover</span>
                      <span>• Overlap: 12:30–16:30 IST</span>
                      <span>• Uptime: 99.illustrative equity</span>
                    </div>
                  </div>
                  <button
                    onClick={launchJourney3}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs shadow-md transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Launch Flow 3</span>
                  </button>
                </div>
              </div>

              {/* Flow 4 */}
              <div className="p-4 rounded-xl bg-[#151B24]/90 border border-slate-800 hover:border-indigo-500/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold">
                        FLOW 4 · §24.4
                      </span>
                      <h4 className="font-display font-bold text-sm text-slate-100">
                        Autonomous Week Autopilot (26 Oct–1 Nov)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300">
                      Switch to planning week <span className="font-mono text-[#818CF8]">26 Oct–1 Nov 2026</span>. Generate isolated AI Roster Proposal with 96% equity, 0 rest turnaround violations (&lt;11h), review diffs, apply to draft, and publish <span className="font-mono text-emerald-400">v3.0</span>.
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                      <span>• Target: Schedule Workspace</span>
                      <span>• Scope: 26 Oct–1 Nov 2026</span>
                      <span>• Engine: Deterministic Heuristic AI</span>
                    </div>
                  </div>
                  <button
                    onClick={launchJourney4}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#818CF8] hover:bg-indigo-400 text-slate-950 font-display font-bold text-xs shadow-md transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Launch Flow 4</span>
                  </button>
                </div>
              </div>

              {/* Flow 5 */}
              <div className="p-4 rounded-xl bg-[#151B24]/90 border border-slate-800 hover:border-[#06B6D4]/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#06B6D4]/20 text-[#22D3EE] font-mono text-[10px] font-bold">
                        FLOW 5 · §24.5
                      </span>
                      <h4 className="font-display font-bold text-sm text-slate-100">
                        Shift Trade Atomic Swap
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300">
                      Review trade <span className="font-mono text-[#22D3EE]">TR-2026-304</span> between Marcus Chen (2ND) and Elena Petrova (GEN) on Sun 25 Oct. Verify turnaround rest (&gt;11h for both), approve, and atomically stage both draft assignments together.
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                      <span>• Target: Shift Trades Tab</span>
                      <span>• Operators: Marcus Chen & Elena Petrova</span>
                      <span>• Policy: Atomic Swap</span>
                    </div>
                  </div>
                  <button
                    onClick={launchJourney5}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-slate-950 font-display font-bold text-xs shadow-md transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Launch Flow 5</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>All flows persist in browser localStorage with single-click Undo & Reset.</span>
              </div>
              <button
                onClick={() => setJourneysModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#151B24] hover:bg-slate-800 text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Command Palette Modal (Ctrl/Cmd + K) */}
      <GlobalCommandPalette />

      {/* Floating Active Guided Journey Stepper HUD */}
      {showFlowHud && activeFlowId && (
        <div
          role="region"
          aria-label="Active Guided Journey Stepper"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[450] w-[95%] max-w-3xl rounded-2xl bg-[#0D1117]/95 backdrop-blur-xl border border-[#06B6D4]/60 shadow-[0_12px_45px_rgba(0,0,0,0.8)] p-3 px-4 flex flex-col md:flex-row items-center justify-between gap-3 animate-fade-in"
        >
          <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
            <div className="w-8 h-8 rounded-xl bg-[#06B6D4]/20 border border-[#06B6D4]/50 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4 text-[#22D3EE] animate-spin-slow" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-[#06B6D4] text-slate-950">
                  FLOW {activeFlowId} / 5
                </span>
                <span className="font-display font-bold text-xs text-slate-100 truncate">
                  {flowsMeta[activeFlowId - 1].title} ({flowsMeta[activeFlowId - 1].section})
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {flowsMeta[activeFlowId - 1].step}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              onClick={executeCurrentFlowStep}
              title="One-click execute current step and stage results"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
              <span>{flowsMeta[activeFlowId - 1].actionLabel}</span>
            </button>

            <button
              onClick={startNextFlow}
              title="Advance to next guided journey flow"
              className="px-3 py-1.5 rounded-xl bg-[#151B24] hover:bg-slate-800 border border-[#06B6D4]/40 hover:border-[#06B6D4] text-[#22D3EE] font-display font-bold text-xs flex items-center gap-1 transition-colors"
            >
              <span>Next Flow</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setJourneysModalOpen(true)}
              title="Open all flows catalog"
              className="p-1.5 rounded-lg bg-[#151B24] hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Layers className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowFlowHud(false)}
              aria-label="Dismiss flow HUD"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 right-5 z-[500] max-w-md rounded-2xl bg-[#0D1117]/95 backdrop-blur-xl border border-[#06B6D4]/60 shadow-2xl p-4 flex items-start gap-3"
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
