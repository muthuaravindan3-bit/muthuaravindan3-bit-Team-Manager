import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { AuthProvider, useAuth } from './AuthContext';
import { TimezoneProvider } from './TimezoneContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import { ToastProvider } from './ToastContext';
import Navigation, { WorkspaceTab, QuickDrawerType } from './components/Navigation';
import TopActionBar, {
  SubTabOption,
  ContextualToolbarProps,
} from './components/TopActionBar';
import QuickActionDrawer from './components/QuickActionDrawer';
import Dashboard from './components/Dashboard';
import ShiftSwap from './components/ShiftSwap';
import Leaves from './components/Leaves';
import Operations from './components/Operations';
import TeamChat from './components/TeamChat';
import Troubleshooter from './components/Troubleshooter';
import ShiftHandoverBoard from './components/ShiftHandoverBoard';
import { AIChat } from './components/AIChat';
import AdminPanel, { AdminTab } from './components/AdminPanel';
import CommandPalette from './components/CommandPalette';
import { Shift, IncidentTicket } from './types';
import {
  CalendarDays,
  ArrowLeftRight,
  Wrench,
  Sun,
  Moon,
  AlertCircle,
  RefreshCw,
  LogIn,
  Keyboard,
  X,
  AlertTriangle,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { startOfWeek } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught workspace error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage =
        'An unexpected error occurred while loading this view.';
      try {
        const parsed = JSON.parse(this.state.error?.message || '');
        if (parsed.error) {
          friendlyMessage = `Database sync issue (${parsed.operationType}): ${parsed.error}`;
        }
      } catch {
        friendlyMessage = this.state.error?.message || friendlyMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-1 p-6">
          <div className="max-w-md w-full p-6 rounded-xl bg-surface-2 border border-main-border shadow-lg space-y-4">
            <div className="flex items-center gap-3 text-error">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h2 className="text-base font-semibold text-main-text">
                Something interrupted the workspace
              </h2>
            </div>
            <p className="text-xs text-main-text-muted leading-relaxed">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const MODULE_LABELS: Record<WorkspaceTab, string> = {
  dashboard: 'Overview',
  schedule: 'Schedule & Roster',
  requests: 'Swaps & Time Off',
  operations: 'Team & Breaks',
  support: 'Help & Team Chat',
  admin: 'Workspace Admin',
};

export type ScheduleSubTab = 'week' | 'matrix' | 'timeline' | 'list' | 'mine';

function AppContent() {
  const { user, loading, signIn, isAdmin, isSigningIn, authError, setAuthError } =
    useAuth();
  const { isDark, toggleTheme, isZenMode, toggleZenMode } = useTheme();

  // Primary & Contextual Sub-Navigation State
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [dashboardSubTab, setDashboardSubTab] = useState<'summary' | 'roster'>(
    'summary'
  );
  const [scheduleSubTab, setScheduleSubTab] =
    useState<ScheduleSubTab>('week');
  const [requestsSubTab, setRequestsSubTab] = useState<'swaps' | 'leaves'>(
    'swaps'
  );
  const [operationsSubTab, setOperationsSubTab] = useState<
    'directory' | 'tracker' | 'breaks' | 'handover'
  >('directory');
  const [supportSubTab, setSupportSubTab] = useState<
    'chat' | 'troubleshooter' | 'handover'
  >('chat');
  const [adminSubTab, setAdminSubTab] = useState<AdminTab>('planner');
  const [initialTroubleshootProblem, setInitialTroubleshootProblem] = useState<
    string | null
  >(null);
  const [dismissedIncidentBannerId, setDismissedIncidentBannerId] = useState<
    string | null
  >(null);

  // Contextual Sub-Menu Toolbar State
  const [scheduleWeekStart, setScheduleWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<string>('all');
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState<string>('');
  const [requestsStatusFilter, setRequestsStatusFilter] = useState<
    'all' | 'pending' | 'accepted' | 'approved' | 'rejected'
  >('all');
  const [operationsSearchQuery, setOperationsSearchQuery] = useState<string>('');
  const [operationsOnlyOnBreak, setOperationsOnlyOnBreak] =
    useState<boolean>(false);

  // Slide-Over Quick Action Drawer, Shift Inspector, Command Palette & Shortcuts HUD
  const [activeQuickDrawer, setActiveQuickDrawer] =
    useState<QuickDrawerType>(null);
  const [inspectedShift, setInspectedShift] = useState<Shift | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Live Badge Counters
  const [pendingSwapsCount, setPendingSwapsCount] = useState(0);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);
  const [activeBreaksCount, setActiveBreaksCount] = useState(0);
  const [openIncidentsCount, setOpenIncidentsCount] = useState(0);
  const [latestActiveIncident, setLatestActiveIncident] =
    useState<IncidentTicket | null>(null);

  const handleSelectModuleSubTab = (tab: WorkspaceTab, subTab: string) => {
    setActiveTab(tab);
    if (tab === 'dashboard') {
      setDashboardSubTab(subTab as 'summary' | 'roster');
    } else if (tab === 'schedule') {
      setScheduleSubTab(subTab as ScheduleSubTab);
    } else if (tab === 'requests') {
      setRequestsSubTab(subTab as 'swaps' | 'leaves');
    } else if (tab === 'operations') {
      setOperationsSubTab(
        subTab as 'directory' | 'tracker' | 'breaks' | 'handover'
      );
    } else if (tab === 'support') {
      setSupportSubTab(subTab as 'chat' | 'troubleshooter' | 'handover');
    } else if (tab === 'admin') {
      setAdminSubTab(subTab as AdminTab);
    }
  };

  const handleDiagnoseIncident = (problemText: string) => {
    setInitialTroubleshootProblem(problemText);
    setActiveTab('support');
    setSupportSubTab('troubleshooter');
  };

  const handleInspectShift = (shift: Shift) => {
    setInspectedShift(shift);
    setActiveQuickDrawer('inspect-shift');
  };

  const totalPendingRequests = pendingSwapsCount + pendingLeavesCount;

  const getSubTabConfig = (): {
    subTabs: SubTabOption[];
    activeSubTab: string;
    onSelectSubTab: (id: string) => void;
  } => {
    switch (activeTab) {
      case 'dashboard':
        return {
          subTabs: [],
          activeSubTab: dashboardSubTab,
          onSelectSubTab: (id) => setDashboardSubTab(id as 'summary' | 'roster'),
        };
      case 'schedule':
        return {
          subTabs: [
            { id: 'week', label: '7-Day Week' },
            { id: 'matrix', label: 'Matrix Heatmap' },
            { id: 'timeline', label: '24h Timeline' },
            { id: 'list', label: 'Roster Table' },
            { id: 'mine', label: 'My Shifts' },
          ],
          activeSubTab: scheduleSubTab,
          onSelectSubTab: (id) => setScheduleSubTab(id as ScheduleSubTab),
        };
      case 'requests':
        return {
          subTabs: [
            {
              id: 'swaps',
              label: 'Shift Swaps',
              badge: pendingSwapsCount,
            },
            {
              id: 'leaves',
              label: 'Leave Requests',
              badge: pendingLeavesCount,
            },
          ],
          activeSubTab: requestsSubTab,
          onSelectSubTab: (id) => setRequestsSubTab(id as 'swaps' | 'leaves'),
        };
      case 'operations':
        return {
          subTabs: [
            { id: 'directory', label: 'Live Directory' },
            {
              id: 'tracker',
              label: 'Live Break Tracker',
              badge: activeBreaksCount,
            },
            {
              id: 'breaks',
              label: 'Break Logs',
            },
            {
              id: 'handover',
              label: 'Shift Handover Board',
              badge: openIncidentsCount,
            },
          ],
          activeSubTab: operationsSubTab,
          onSelectSubTab: (id) =>
            setOperationsSubTab(
              id as 'directory' | 'tracker' | 'breaks' | 'handover'
            ),
        };
      case 'support':
        return {
          subTabs: [
            { id: 'troubleshooter', label: 'AI Troubleshooter' },
            {
              id: 'handover',
              label: 'Shift Handover',
              badge: openIncidentsCount,
            },
            { id: 'chat', label: 'Team Chat' },
          ],
          activeSubTab: supportSubTab,
          onSelectSubTab: (id) =>
            setSupportSubTab(id as 'chat' | 'troubleshooter' | 'handover'),
        };
      case 'admin':
        return {
          subTabs: [
            { id: 'planner', label: 'Schedule Planner' },
            {
              id: 'approvals',
              label: 'Approvals Queue',
              badge: totalPendingRequests,
            },
            { id: 'team', label: 'Team & Payroll' },
            { id: 'settings', label: 'Settings & Audit' },
          ],
          activeSubTab: adminSubTab,
          onSelectSubTab: (id) => setAdminSubTab(id as AdminTab),
        };
    }
  };

  const { subTabs, activeSubTab, onSelectSubTab } = getSubTabConfig();

  // Global Keyboard Shortcuts: Cmd+K (Command Palette), Cmd+B (Toggle Sidebar), Shift+Z (Zen Focus), Alt+1..5 (Sub-Tabs), ? (Shortcuts HUD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      } else if (!isInputFocused && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        toggleZenMode();
      } else if (e.altKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
        const index = Number(e.key) - 1;
        if (subTabs[index]) {
          e.preventDefault();
          onSelectSubTab(subTabs[index].id);
        }
      } else if (!isInputFocused && e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [subTabs, onSelectSubTab, toggleZenMode]);

  // Subscribe to live counts for menu badges & active shift incidents
  useEffect(() => {
    if (!user) return;

    const unsubSwaps = onSnapshot(
      collection(db, 'shiftSwaps'),
      (snap) => {
        const pending = snap.docs.filter((d) => {
          const st = d.data().status;
          return st === 'pending' || (isAdmin && st === 'accepted');
        }).length;
        setPendingSwapsCount(pending);
      },
      () => {}
    );

    const leavesBadgeQuery = isAdmin
      ? collection(db, 'leaveRequests')
      : query(
          collection(db, 'leaveRequests'),
          where('userId', '==', user.uid)
        );

    const unsubLeaves = onSnapshot(
      leavesBadgeQuery,
      (snap) => {
        const pending = snap.docs.filter((d) => {
          const data = d.data();
          if (isAdmin) return data.status === 'pending';
          return data.userId === user.uid && data.status === 'pending';
        }).length;
        setPendingLeavesCount(pending);
      },
      () => {}
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const onBreak = snap.docs.filter((d) =>
          Boolean(d.data().isBreakActive)
        ).length;
        setActiveBreaksCount(onBreak);
      },
      () => {}
    );

    const unsubIncidents = onSnapshot(
      collection(db, 'incidentTickets'),
      (snap) => {
        const openList = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as IncidentTicket))
          .filter((t) => t.status !== 'resolved')
          .sort(
            (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
          );
        setOpenIncidentsCount(openList.length);
        setLatestActiveIncident(openList[0] || null);
      },
      () => {}
    );

    return () => {
      unsubSwaps();
      unsubLeaves();
      unsubUsers();
      unsubIncidents();
    };
  }, [user, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-text font-bold text-sm animate-pulse">
            SS
          </div>
          <p className="text-xs font-medium text-main-text-muted">
            Loading ShiftSync workspace...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // UNAUTHENTICATED LANDING VIEW
  // ============================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-surface-1 text-main-text flex flex-col">
        {/* 3-Zone Top Bar Contract */}
        <header className="h-16 px-6 lg:px-10 border-b border-main-border bg-surface-2/85 backdrop-blur-xl flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-active flex items-center justify-center text-primary-text font-bold text-xs shadow-sm">
              SS
            </div>
            <span className="font-display font-bold text-base tracking-tight">
              ShiftSync
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="btn-secondary py-2 px-3 flex items-center gap-2 text-xs cursor-pointer"
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-primary" />
                  <span>Titanium Daylight</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-primary" />
                  <span>Carbon Obsidian</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={signIn}
              disabled={isSigningIn}
              className="btn-primary flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSigningIn ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </div>
        </header>

        {/* Main Hero & Feature Grid */}
        <main className="flex-1 flex flex-col justify-center max-w-5xl w-full mx-auto px-6 py-16 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="max-w-2xl space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-subtle border border-primary/30 text-xs font-semibold text-primary tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>2026+ 120fps Autonomous Workforce Command</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight text-main-text leading-[1.12]">
              Effortless shift planning, break tracking, and team support.
            </h1>
            <p className="text-base sm:text-lg text-main-text-muted leading-relaxed">
              Keep your entire team aligned across timezones. View upcoming
              shifts, run 1-click autonomous week balancing, inspect the 7-day
              fatigue matrix, and resolve workplace issues in one high-speed
              command deck.
            </p>

            {authError && (
              <div className="p-4 rounded-xl bg-error-subtle border border-error/30 flex items-start justify-between gap-3">
                <div className="text-xs text-main-text">
                  <strong className="font-semibold text-error block mb-0.5">
                    Sign-in notice
                  </strong>
                  {authError}
                </div>
                <button
                  type="button"
                  onClick={() => setAuthError(null)}
                  className="text-xs font-semibold text-main-text-muted hover:text-main-text"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={signIn}
                disabled={isSigningIn}
                className="btn-primary py-3 px-6 text-sm flex items-center gap-2.5 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {isSigningIn
                    ? 'Connecting Account...'
                    : 'Continue with Google'}
                </span>
              </button>
              <span className="text-xs text-main-text-muted">
                Instant access · Automatic timezone detection
              </span>
            </div>
          </motion.div>

          {/* 3-Column Feature Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16 pt-12 border-t border-main-border">
            {[
              {
                icon: CalendarDays,
                title: '120fps Autonomous Rosters',
                desc: '7-Day Coverage & Fatigue Matrix, 24-hour Orbital Chrono-Ring, and 1-click Autopilot Week balancing.',
              },
              {
                icon: ArrowLeftRight,
                title: 'Slide-Over Swaps & Leave',
                desc: 'Offer a shift to teammates with automatic conflict checking or request time off from any screen without losing your place.',
              },
              {
                icon: Wrench,
                title: 'Built-In Ops Troubleshooter',
                desc: 'Step-by-step L1 diagnostic checklists for POS, network, and workplace equipment alongside live team chat.',
              },
            ].map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 380,
                    damping: 28,
                    delay: 0.08 + idx * 0.06,
                  }}
                  className="p-5 rounded-xl glass-card space-y-2.5"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary-subtle border border-primary/20 flex items-center justify-center text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-display font-semibold text-main-text">
                    {feat.title}
                  </h2>
                  <p className="text-xs text-main-text-muted leading-relaxed">
                    {feat.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  const contextualToolbar: ContextualToolbarProps = {
    weekStart: scheduleWeekStart,
    onChangeWeekStart: setScheduleWeekStart,
    shiftTypeFilter: scheduleTypeFilter,
    onChangeShiftTypeFilter: setScheduleTypeFilter,
    scheduleSearchQuery,
    onChangeScheduleSearchQuery: setScheduleSearchQuery,
    requestsStatusFilter,
    onChangeRequestsStatusFilter: setRequestsStatusFilter,
    operationsSearchQuery,
    onChangeOperationsSearchQuery: setOperationsSearchQuery,
    operationsOnlyOnBreak,
    onChangeOperationsOnlyOnBreak: setOperationsOnlyOnBreak,
  };

  const effectiveCollapsed = isSidebarCollapsed || isZenMode;

  // ============================================================================
  // AUTHENTICATED WORKSPACE SHELL
  // ============================================================================
  return (
    <div className="min-h-screen bg-surface-1 text-main-text flex flex-col">
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSubTab={activeSubTab}
        onSelectModuleSubTab={handleSelectModuleSubTab}
        isCollapsed={effectiveCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        onOpenQuickDrawer={setActiveQuickDrawer}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenShortcutsModal={() => setShowShortcutsModal(true)}
        pendingSwapsCount={pendingSwapsCount}
        pendingLeavesCount={pendingLeavesCount}
        activeBreaksCount={activeBreaksCount}
        openIncidentsCount={openIncidentsCount}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-150 ${
          effectiveCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[236px]'
        }`}
      >
        <TopActionBar
          activeTab={activeTab}
          moduleLabel={MODULE_LABELS[activeTab]}
          subTabs={subTabs}
          activeSubTab={activeSubTab}
          onSelectSubTab={onSelectSubTab}
          onNavigateModuleSubTab={handleSelectModuleSubTab}
          onOpenQuickDrawer={setActiveQuickDrawer}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenShortcutsModal={() => setShowShortcutsModal(true)}
          onInspectShift={handleInspectShift}
          isAIChatOpen={isAIChatOpen}
          onToggleAIChat={() => setIsAIChatOpen((prev) => !prev)}
          toolbar={contextualToolbar}
        />

        {/* Main Content Viewport */}
        <main
          className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12 min-w-0 space-y-6 ${
            isZenMode ? 'max-w-[1440px]' : 'max-w-6xl'
          }`}
        >
          {/* Live Shift Handover Active Incident Alert Strip */}
          {!isZenMode &&
            openIncidentsCount > 0 &&
            latestActiveIncident &&
            dismissedIncidentBannerId !== latestActiveIncident.id &&
            activeSubTab !== 'handover' && (
              <div className="p-3.5 rounded-xl bg-warning/10 border border-warning/35 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-warning/20 border border-warning/40 flex items-center justify-center text-warning shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-main-text">
                        {openIncidentsCount} Active Shift Incident
                        {openIncidentsCount > 1 ? 's' : ''} on Handover Board
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-warning/20 text-warning font-mono text-[10px] font-bold">
                        {latestActiveIncident.ticketNumber} ·{' '}
                        {latestActiveIncident.tier}
                      </span>
                    </div>
                    <p className="text-xs text-main-text-muted truncate">
                      {latestActiveIncident.title} ({latestActiveIncident.team})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleDiagnoseIncident(latestActiveIncident.title)
                    }
                    className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5 text-primary" />
                    <span>Diagnose in AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectModuleSubTab('support', 'handover')
                    }
                    className="btn-primary py-1 px-3 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Handover Board</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDismissedIncidentBannerId(latestActiveIncident.id)
                    }
                    className="p-1 text-main-text-muted hover:text-main-text cursor-pointer"
                    aria-label="Dismiss incident banner"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${activeSubTab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard
                  mode="overview"
                  subTab={dashboardSubTab}
                  onNavigate={setActiveTab}
                  onNavigateModuleSubTab={handleSelectModuleSubTab}
                  onSelectSubTab={(id) =>
                    setDashboardSubTab(id as 'summary' | 'roster')
                  }
                  onOpenQuickDrawer={setActiveQuickDrawer}
                  onInspectShift={handleInspectShift}
                  externalWeekStart={scheduleWeekStart}
                  onChangeExternalWeekStart={setScheduleWeekStart}
                  externalTypeFilter={scheduleTypeFilter}
                  onChangeExternalTypeFilter={setScheduleTypeFilter}
                  externalSearchQuery={scheduleSearchQuery}
                  onChangeExternalSearchQuery={setScheduleSearchQuery}
                />
              )}

              {activeTab === 'schedule' && (
                <Dashboard
                  mode="schedule"
                  subTab={scheduleSubTab}
                  onNavigate={setActiveTab}
                  onNavigateModuleSubTab={handleSelectModuleSubTab}
                  onSelectSubTab={(id) =>
                    setScheduleSubTab(id as ScheduleSubTab)
                  }
                  onOpenQuickDrawer={setActiveQuickDrawer}
                  onInspectShift={handleInspectShift}
                  externalWeekStart={scheduleWeekStart}
                  onChangeExternalWeekStart={setScheduleWeekStart}
                  externalTypeFilter={scheduleTypeFilter}
                  onChangeExternalTypeFilter={setScheduleTypeFilter}
                  externalSearchQuery={scheduleSearchQuery}
                  onChangeExternalSearchQuery={setScheduleSearchQuery}
                />
              )}

              {activeTab === 'requests' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-display font-bold text-main-text tracking-tight">
                      {requestsSubTab === 'swaps'
                        ? 'Shift Swap Marketplace'
                        : 'Time Off & Leave Requests'}
                    </h1>
                    <p className="text-sm text-main-text-muted mt-0.5">
                      {requestsSubTab === 'swaps'
                        ? 'Offer an upcoming shift to teammates or volunteer to cover an open shift.'
                        : 'Submit vacation, personal, or medical leave requests and track approvals.'}
                    </p>
                  </div>

                  {requestsSubTab === 'swaps' ? (
                    <ShiftSwap
                      onOpenQuickDrawer={setActiveQuickDrawer}
                      externalStatusFilter={requestsStatusFilter}
                      onChangeExternalStatusFilter={setRequestsStatusFilter}
                    />
                  ) : (
                    <Leaves
                      onOpenQuickDrawer={setActiveQuickDrawer}
                      externalStatusFilter={requestsStatusFilter}
                      onChangeExternalStatusFilter={setRequestsStatusFilter}
                    />
                  )}
                </div>
              )}

              {activeTab === 'operations' &&
                (operationsSubTab === 'handover' ? (
                  <div className="space-y-5">
                    <div>
                      <h1 className="text-xl font-display font-bold text-main-text tracking-tight">
                        Shift Handover Board
                      </h1>
                      <p className="text-xs text-main-text-muted mt-0.5">
                        Review active incidents across shifts and complete shift sign-offs.
                      </p>
                    </div>
                    <ShiftHandoverBoard
                      onDiagnoseIncident={handleDiagnoseIncident}
                    />
                  </div>
                ) : (
                  <Operations
                    subTab={operationsSubTab}
                    onSelectSubTab={setOperationsSubTab}
                    onOpenQuickDrawer={setActiveQuickDrawer}
                    externalSearchQuery={operationsSearchQuery}
                    onChangeExternalSearchQuery={setOperationsSearchQuery}
                    externalOnlyOnBreak={operationsOnlyOnBreak}
                  />
                ))}

              {activeTab === 'support' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-display font-bold text-main-text tracking-tight">
                      {supportSubTab === 'chat'
                        ? 'Team Channels'
                        : supportSubTab === 'handover'
                        ? 'Shift Handover Board'
                        : 'AI Troubleshooter'}
                    </h1>
                    <p className="text-xs text-main-text-muted mt-0.5">
                      {supportSubTab === 'chat'
                        ? 'Coordinate shift updates with teammates in real time.'
                        : supportSubTab === 'handover'
                        ? 'Track open shift incidents and complete formal shift sign-offs.'
                        : 'Diagnose workplace issues step-by-step or browse past team solutions.'}
                    </p>
                  </div>

                  {supportSubTab === 'chat' ? (
                    <TeamChat />
                  ) : supportSubTab === 'handover' ? (
                    <ShiftHandoverBoard
                      onDiagnoseIncident={handleDiagnoseIncident}
                    />
                  ) : (
                    <Troubleshooter
                      initialIncidentProblem={initialTroubleshootProblem}
                      onClearInitialIncident={() =>
                        setInitialTroubleshootProblem(null)
                      }
                      onOpenHandoverBoard={() =>
                        handleSelectModuleSubTab('support', 'handover')
                      }
                    />
                  )}
                </div>
              )}

              {activeTab === 'admin' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-display font-bold text-main-text tracking-tight">
                      {adminSubTab === 'planner'
                        ? 'Schedule Planner'
                        : adminSubTab === 'approvals'
                        ? 'Approvals Queue'
                        : adminSubTab === 'team'
                        ? 'Team & Payroll'
                        : 'Workspace Settings'}
                    </h1>
                    <p className="text-xs text-main-text-muted mt-0.5">
                      {adminSubTab === 'planner'
                        ? 'Assign individual shifts, auto-schedule a week, or import from a spreadsheet.'
                        : adminSubTab === 'approvals'
                        ? 'Review and approve pending time off and shift swap requests.'
                        : adminSubTab === 'team'
                        ? 'Manage team members, roles, and estimated payroll.'
                        : 'Post team announcements, configure defaults, and view manager activity.'}
                    </p>
                  </div>
                  <AdminPanel subTab={adminSubTab} onSelectSubTab={setAdminSubTab} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Slide-Over Action & Shift Inspector Drawers */}
      <QuickActionDrawer
        activeDrawer={activeQuickDrawer}
        inspectedShift={inspectedShift}
        onSwitchDrawer={setActiveQuickDrawer}
        onClose={() => setActiveQuickDrawer(null)}
      />

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        setActiveTab={setActiveTab}
        onSelectSubTab={handleSelectModuleSubTab}
        onOpenQuickDrawer={setActiveQuickDrawer}
        isAdmin={isAdmin}
      />

      {/* Global Docked AI Engineering Assistant Drawer (triggered from TopActionBar) */}
      {activeTab !== 'support' && (
        <AIChat
          docked
          isOpen={isAIChatOpen}
          onToggleOpen={(next) =>
            setIsAIChatOpen((prev) => (next !== undefined ? next : !prev))
          }
          onOpenFullWorkbench={() =>
            handleSelectModuleSubTab('support', 'troubleshooter')
          }
        />
      )}

      {/* Keyboard Shortcuts HUD Modal (?) */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowShortcutsModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard Shortcuts"
        >
          <div
            className="w-full max-w-md bg-surface-2 border border-main-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-main-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-display font-bold text-main-text">
                  2026+ 120fps Spatial Keyboard Shortcuts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-lg text-main-text-muted hover:text-main-text cursor-pointer"
                aria-label="Close shortcuts dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-2.5 text-xs">
              {[
                { keys: '⌘K / Ctrl+K', desc: 'Open Global Command Palette' },
                {
                  keys: '⌘B / Ctrl+B',
                  desc: 'Collapse or Expand Left Sidebar',
                },
                {
                  keys: 'Shift + Z',
                  desc: 'Toggle Zen Command Focus Mode',
                },
                {
                  keys: 'Alt + 1…5',
                  desc: 'Switch Sub-Tabs in Current Module',
                },
                {
                  keys: 'J / K (Roster)',
                  desc: 'Glide Focus Cursor Down / Up Across Rows',
                },
                {
                  keys: '1 / 2 / 3 / G / W / C',
                  desc: 'Instant Morph Focused Shift Row (Admin)',
                },
                {
                  keys: 'F / Space (Roster)',
                  desc: 'Open Smart Cover Matcher / Inspect Row',
                },
                { keys: '?', desc: 'Toggle Keyboard Shortcuts HUD' },
              ].map((item) => (
                <div
                  key={item.keys}
                  className="flex items-center justify-between py-1.5 border-b border-main-border last:border-0"
                >
                  <span className="text-main-text-muted">{item.desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-surface-1 border border-main-border font-mono text-[11px] text-primary font-semibold">
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TimezoneProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </TimezoneProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
