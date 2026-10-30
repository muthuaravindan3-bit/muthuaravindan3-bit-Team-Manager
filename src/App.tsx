import { ScenePanel } from './components/scenes/ScenePanel';
import { clearSessionDrafts } from './hooks/useDraftString';
import { useModalFocus } from './hooks/useModalFocus';
import { SavedViews } from './components/SavedViews';
import React, { useState, useEffect, useRef, lazy, Suspense, ErrorInfo, ReactNode } from 'react';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { AuthProvider, useAuth } from './AuthContext';
import { TimezoneProvider } from './TimezoneContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import Navigation, { WorkspaceTab, QuickDrawerType } from './components/Navigation';
import TopActionBar, {
  SubTabOption,
  ContextualToolbarProps,
} from './components/TopActionBar';
import QuickActionDrawer from './components/QuickActionDrawer';
const Dashboard = lazy(() => import('./components/Dashboard'));
const ShiftSwap = lazy(() => import('./components/ShiftSwap'));
const Leaves = lazy(() => import('./components/Leaves'));
const Operations = lazy(() => import('./components/Operations'));
const TeamChat = lazy(() => import('./components/TeamChat'));
const Troubleshooter = lazy(() => import('./components/Troubleshooter'));
const ShiftHandoverBoard = lazy(() => import('./components/ShiftHandoverBoard'));
const AIChat = lazy(() => import('./components/AIChat').then((module) => ({ default: module.AIChat })));
import type { AdminTab } from './components/AdminPanel';
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Overview = lazy(() => import('./components/Overview'));
import { Skeleton, Button } from './components/ui/WorkspaceUI';
import { readWorkspaceLocation, readShiftRecordId } from './utils/workspaceNavigation';
import { UI_COPY } from './constants/uiCopy';
import { usePreference } from './hooks/usePreference';
import { z } from 'zod';
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
import { MyWeekContext } from './components/MyWeekContext';
import { addDays, format, startOfWeek } from 'date-fns';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';

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
    void error; void errorInfo; // Error details stay out of user-facing messages and browser logs.
  }

  render() {
    if (this.state.hasError) {
      const friendlyMessage = 'This view could not be loaded. Reload the workspace to try again.';

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

const MODULE_LABELS = UI_COPY.modules;

function initialScheduleDate() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('scope')?.replace(/^scope-/, '') ?? params.get('date');
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && format(parsed, 'yyyy-MM-dd') === value ? parsed : new Date();
}

function AppContent() {
  const { user, loading, startupError, retryStartup, signIn, isAdmin, isSigningIn, authError, setAuthError } =
    useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => { const update = () => setIsOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);

  // Primary & Contextual Sub-Navigation State
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePreference('shiftsync-sidebar-v1', false, z.boolean());

  const [dashboardSubTab, setDashboardSubTab] = useState<'summary' | 'roster' | 'attention' | 'activity'>(
    'summary'
  );
  const [scheduleSubTab, setScheduleSubTab] = useState<'week' | 'list' | 'mine'>(
    'week'
  );
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
    startOfWeek(initialScheduleDate(), { weekStartsOn: 1 })
  );
  const [calendarFocusDay,setCalendarFocusDay]=useState('');
  const [scheduleTypeFilter, setScheduleTypeFilter] = usePreference('shiftsync-schedule-type-v1', 'all', z.string());
  const [scheduleSearchQuery, setScheduleSearchQuery] = usePreference('shiftsync-schedule-search-v1', '', z.string());
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
  const [assistantLoaded, setAssistantLoaded] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const shortcutsRef = useModalFocus<HTMLDivElement>(showShortcutsModal, () => setShowShortcutsModal(false));
  useEffect(() => { if (!user) clearSessionDrafts(); }, [user]);
  const [compactViewport, setCompactViewport] = useState(() => window.matchMedia('(min-width: 1024px) and (max-width: 1279px)').matches);
  useEffect(() => { const media = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)'); const update = () => setCompactViewport(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const sidebarCollapsed = compactViewport || isSidebarCollapsed;

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
      setDashboardSubTab(subTab as 'summary' | 'roster' | 'attention' | 'activity');
    } else if (tab === 'schedule') {
      setScheduleSubTab(subTab as 'week' | 'list' | 'mine');
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

  const navigationReady = useRef(false);
  const scrollPositions = useRef(new Map<string, number>());
  const scrollRoute = `${activeTab}/${activeSubTabForScroll()}`;
  function activeSubTabForScroll() { return ({ dashboard: dashboardSubTab, schedule: scheduleSubTab, requests: requestsSubTab, operations: operationsSubTab, support: supportSubTab, admin: adminSubTab })[activeTab]; }
  useEffect(() => {
    const restoreFrame = requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current.get(scrollRoute) ?? 0));
    const remember = () => scrollPositions.current.set(scrollRoute, window.scrollY);
    window.addEventListener('scroll', remember, { passive: true });
    return () => { cancelAnimationFrame(restoreFrame); window.removeEventListener('scroll', remember); };
  }, [scrollRoute]);
  useEffect(() => {
    const restore = () => {
      const location = readWorkspaceLocation(window.location.search);
      handleSelectModuleSubTab(location.workspace, location.view);
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    if (!navigationReady.current) { navigationReady.current = true; return; }
    const views = { dashboard: dashboardSubTab, schedule: scheduleSubTab, requests: requestsSubTab, operations: operationsSubTab, support: supportSubTab, admin: adminSubTab };
    const current = readWorkspaceLocation(window.location.search);
    if (current.workspace === activeTab && current.view === views[activeTab]) return;
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', activeTab);
    url.searchParams.set('view', views[activeTab]);
    url.searchParams.delete('subview');
    window.history.pushState(null, '', url);
  }, [activeTab, dashboardSubTab, scheduleSubTab, requestsSubTab, operationsSubTab, supportSubTab, adminSubTab]);

  const handleDiagnoseIncident = (problemText: string) => {
    setInitialTroubleshootProblem(problemText);
    setActiveTab('support');
    setSupportSubTab('troubleshooter');
  };

  const handleInspectShift = (shift: Shift) => {
    const url = new URL(window.location.href);
    url.searchParams.set('shift', shift.id);
    window.history.pushState({ shiftPanel: true }, '', url);
    setInspectedShift(shift);
    setActiveQuickDrawer('inspect-shift');
  };

  const closeQuickDrawer = () => {
    setActiveQuickDrawer(null);
    if (!new URLSearchParams(window.location.search).has('shift')) return;
    if (window.history.state?.shiftPanel) window.history.back();
    else { const url = new URL(window.location.href); url.searchParams.delete('shift'); window.history.replaceState(null, '', url); }
  };
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const restoreRecord = async () => {
      const id = readShiftRecordId(window.location.search);
      if (!id) { setActiveQuickDrawer((current) => current === 'inspect-shift' ? null : current); return; }
      try {
        const snapshot = await getDoc(doc(db, 'shifts', id));
        const schema = z.object({ userId: z.string(), userName: z.string(), date: z.string(), startTime: z.string(), endTime: z.string(), type: z.string(), updatedAt: z.number().optional() });
        const parsed = schema.safeParse(snapshot.data());
        if (!cancelled && readShiftRecordId(window.location.search) === id) { setInspectedShift(parsed.success ? { ...parsed.data, id } : null); setActiveQuickDrawer('inspect-shift'); }
      } catch { if (!cancelled) { setInspectedShift(null); setActiveQuickDrawer('inspect-shift'); } }
    };
    void restoreRecord();
    const onPop = () => { void restoreRecord(); };
    window.addEventListener('popstate', onPop);
    return () => { cancelled = true; window.removeEventListener('popstate', onPop); };
  }, [user?.uid]);

  const totalPendingRequests = pendingSwapsCount + pendingLeavesCount;

  const getSubTabConfig = (): {
    subTabs: SubTabOption[];
    activeSubTab: string;
    onSelectSubTab: (id: string) => void;
  } => {
    switch (activeTab) {
      case 'dashboard':
        return {
          subTabs: [
            { id: 'summary', label: 'Summary' },
            {
              id: 'attention',
              label: 'Needs attention',
              badge: totalPendingRequests + openIncidentsCount,
            },
            { id: 'activity', label: 'Personal activity' },
            { id: 'roster', label: "Today's roster" },
          ],
          activeSubTab: dashboardSubTab,
          onSelectSubTab: (id) =>
            setDashboardSubTab(
              id as 'summary' | 'roster' | 'attention' | 'activity'
            ),
        };
      case 'schedule':
        return {
          subTabs: [
            { id: 'week', label: 'Week' },
            { id: 'list', label: 'List' },
            { id: 'mine', label: 'My week' },
          ],
          activeSubTab: scheduleSubTab,
          onSelectSubTab: (id) =>
            setScheduleSubTab(id as 'week' | 'list' | 'mine'),
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
            { id: 'directory', label: 'People' },
            {
              id: 'tracker',
              label: 'Active breaks',
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
        if (!isAdmin) return { subTabs: [], activeSubTab: '', onSelectSubTab: () => {} };
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

  // Global Keyboard Shortcuts: Cmd+K (Command Palette), Cmd+B (Toggle Sidebar), Alt+1..4 (Sub-Tabs), ? (Shortcuts HUD)
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
      } else if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
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
  }, [subTabs, onSelectSubTab]);

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

  if (startupError) {
    return <main className="min-h-screen grid place-items-center p-6 bg-surface-1"><section className="ui-card max-w-md" role="alert"><h1 className="text-2xl font-display font-semibold">Workspace connection paused</h1><p className="ui-page-description">{startupError}</p><div className="ui-actions"><Button onClick={retryStartup}>Try again</Button></div></section></main>;
  }

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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-active flex items-center justify-center text-primary-text font-bold text-xs shadow-sm ring-1 ring-accent/30">
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
                  <Sun className="w-3.5 h-3.5 text-accent" />
                  <span>Light theme</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-primary" />
                  <span>Dark theme</span>
                </>
              )}
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-subtle border border-accent/30 text-xs font-semibold text-accent tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Your team, in sync</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight text-main-text leading-[1.12]">
              A clear plan for every shift.
            </h1>
            <p className="text-base sm:text-lg text-main-text-muted leading-relaxed">
              See your shifts, request time off, manage breaks, and get help.
              Sign in with your work Google account to open your team workspace.
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
                Use your work account · Automatic timezone detection
              </span>
            </div>
          </motion.div>

        <ScenePanel kind="network" title="Your team, connected" description="An illustration of teamwork. Move your pointer gently over the sculpture." />

          {/* 3-Column Feature Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16 pt-12 border-t border-main-border">
            {[
              {
                icon: CalendarDays,
                title: 'Your schedule',
                desc: 'Every shift automatically adjusts to each team member’s local clock, with 1-click CSV export and smart weekly auto-scheduling.',
              },
              {
                icon: ArrowLeftRight,
                title: 'Swaps and time off',
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
        isCollapsed={sidebarCollapsed}
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
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 ${
          sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[236px]'
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
          toolbar={contextualToolbar}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12 min-w-0 space-y-6">
          {!isOnline && <div className="ui-feedback ui-feedback-info" role="status"><p>You are offline. Saved data may be out of date. Changes cannot be confirmed until your connection returns.</p></div>}
          {/* Live Shift Handover Active Incident Alert Strip */}
          {openIncidentsCount > 0 &&
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


          {activeTab === 'schedule' && <ScenePanel compact kind="calendar" selectedId={activeQuickDrawer === 'inspect-shift' ? inspectedShift?.id : calendarFocusDay || format(scheduleWeekStart,'yyyy-MM-dd')} title="Shift selection" description={activeQuickDrawer === 'inspect-shift' && inspectedShift ? `Selected: ${inspectedShift.userName}, ${inspectedShift.date}, ${inspectedShift.startTime} to ${inspectedShift.endTime} (schedule timezone). The illustration highlights this selection.` : 'Choose a day header or a shift to focus the sculpture. The calendar below contains the actual assignments.'} />}
          {activeTab === 'schedule' && <SavedViews scope={`schedule-${user.uid}`} filters={{ type: scheduleTypeFilter, search: scheduleSearchQuery, view: scheduleSubTab }} onApply={(filters) => { setScheduleTypeFilter(filters.type ?? 'all'); setScheduleSearchQuery(filters.search ?? ''); if (filters.view === 'week' || filters.view === 'list' || filters.view === 'mine') setScheduleSubTab(filters.view); }} />}
          {activeTab === 'requests' && <SavedViews scope={`requests-${user.uid}`} filters={{ status: requestsStatusFilter, view: requestsSubTab }} onApply={(filters) => { const status = filters.status; if (status === 'all' || status === 'pending' || status === 'accepted' || status === 'approved' || status === 'rejected') setRequestsStatusFilter(status); if (filters.view === 'swaps' || filters.view === 'leaves') setRequestsSubTab(filters.view); }} />}
          {activeTab === 'operations' && <div className="ui-saved-views"><Button variant="secondary" onClick={() => { setOperationsSearchQuery(''); setOperationsOnlyOnBreak(false); setOperationsSubTab('directory'); }}>My team</Button><Button variant="secondary" onClick={() => { setOperationsOnlyOnBreak(true); setOperationsSubTab('tracker'); }}>On break</Button></div>}
          <Suspense fallback={<Skeleton />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${activeSubTab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              {activeTab === 'dashboard' &&
                (dashboardSubTab === 'roster' ? (
                  <Dashboard
                    mode="overview"
                    subTab="roster"
                    onNavigate={setActiveTab}
                    onSelectSubTab={(id) =>
                      setDashboardSubTab(
                        id as 'summary' | 'roster' | 'attention' | 'activity'
                      )
                    }
                    onOpenQuickDrawer={setActiveQuickDrawer}
                    onInspectShift={handleInspectShift}
                  />
                ) : (
                  <Overview
                    view={dashboardSubTab}
                    onNavigate={handleSelectModuleSubTab}
                    onOpen={setActiveQuickDrawer}
                    onInspect={handleInspectShift}
                  />
                ))}

              {activeTab === 'schedule' && (
                <><div className="ui-saved-views" aria-label="Schedule views"><Button variant="secondary" onClick={() => { setScheduleTypeFilter('all'); setScheduleSearchQuery(''); setScheduleSubTab('week'); }}>All shifts</Button><Button variant="secondary" onClick={() => { setScheduleTypeFilter('Night'); setScheduleSubTab('list'); }}>Night shifts</Button><Button variant="secondary" onClick={() => { setScheduleTypeFilter('all'); setScheduleSearchQuery(''); setScheduleSubTab('mine'); }}>My week</Button></div>{scheduleSubTab === 'mine' && <MyWeekContext start={format(scheduleWeekStart, 'yyyy-MM-dd')} end={format(addDays(scheduleWeekStart, 6), 'yyyy-MM-dd')} onTimeOff={() => setActiveQuickDrawer('leave')} />}<Dashboard
                  mode="schedule"
                  focusDay={calendarFocusDay || format(scheduleWeekStart,'yyyy-MM-dd')}
                  onFocusDay={setCalendarFocusDay}
                  subTab={scheduleSubTab}
                  onNavigate={setActiveTab}
                  onSelectSubTab={(id) =>
                    setScheduleSubTab(id as 'week' | 'list' | 'mine')
                  }
                  onOpenQuickDrawer={setActiveQuickDrawer}
                  onInspectShift={handleInspectShift}
                  externalWeekStart={scheduleWeekStart}
                  onChangeExternalWeekStart={setScheduleWeekStart}
                  externalTypeFilter={scheduleTypeFilter}
                  onChangeExternalTypeFilter={setScheduleTypeFilter}
                  externalSearchQuery={scheduleSearchQuery}
                  onChangeExternalSearchQuery={setScheduleSearchQuery}
                /></>
              )}

              {activeTab === 'requests' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-display font-bold text-main-text tracking-tight">
                      {requestsSubTab === 'swaps'
                        ? 'Shift swaps'
                        : 'Time off'}
                    </h1>
                    <p className="text-sm text-main-text-muted mt-0.5">
                      {requestsSubTab === 'swaps'
                        ? 'Offer an upcoming shift to teammates or volunteer to cover an open shift.'
                        : 'Submit vacation, personal, or medical leave requests and track approvals.'}
                    </p>
                  </div>

                  <div className="ui-saved-views"><Button variant="secondary" onClick={() => setRequestsStatusFilter('all')}>All requests</Button><Button variant="secondary" onClick={() => setRequestsStatusFilter('pending')}>Pending requests</Button></div>
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

              {activeTab === 'admin' && !isAdmin && <p role="status">Only an admin can open this area. Choose another page from the navigation.</p>}
              {activeTab === 'admin' && isAdmin && (
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
          </Suspense>
        </main>
      </div>

      {/* Slide-Over Action & Shift Inspector Drawers */}
      <QuickActionDrawer
        activeDrawer={activeQuickDrawer}
        inspectedShift={inspectedShift}
        onSwitchDrawer={setActiveQuickDrawer}
        onClose={closeQuickDrawer}
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

      {/* Global Floating AI Engineering Assistant Drawer (hidden when already in Support) */}
      {activeTab !== 'support' && (
        <div className="hidden lg:block">{assistantLoaded ? <Suspense fallback={<span role="status" className="fixed bottom-6 right-6 ui-card">Opening help...</span>}><AIChat initiallyOpen
          onOpenFullWorkbench={() =>
            handleSelectModuleSubTab('support', 'troubleshooter')
          }
        /></Suspense> : <Button className="fixed bottom-6 right-6 z-20" onClick={() => setAssistantLoaded(true)}>Ask for help</Button>}</div>
      )}

      {/* Keyboard Shortcuts HUD Modal (?) */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowShortcutsModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard Shortcuts"
          ref={shortcutsRef}
          data-focus-scope="modal"
          tabIndex={-1}
        >
          <div
            className="w-full max-w-md bg-surface-2 border border-main-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-main-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-display font-bold text-main-text">
                  Keyboard shortcuts
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

            <div className="p-5 space-y-3 text-xs">
              {[
                { keys: '⌘K / Ctrl+K', desc: 'Find a page or action' },
                {
                  keys: '⌘B / Ctrl+B',
                  desc: 'Collapse or Expand Left Sidebar',
                },
                {
                  keys: 'Alt + 1…4',
                  desc: 'Switch Sub-Tabs in Current Module',
                },
                { keys: '?', desc: 'Show keyboard shortcuts' },
                { keys: 'Esc', desc: 'Close Active Slide-Over Drawer or Modal' },
              ].map((item) => (
                <div
                  key={item.keys}
                  className="flex items-center justify-between py-2 border-b border-main-border last:border-0"
                >
                  <span className="text-main-text-muted">{item.desc}</span>
                  <kbd className="px-2 py-1 rounded bg-surface-1 border border-main-border font-mono text-[11px] text-primary font-semibold">
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
    <MotionConfig reducedMotion="user"><ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TimezoneProvider>
            <AppContent />
          </TimezoneProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary></MotionConfig>
  );
}
