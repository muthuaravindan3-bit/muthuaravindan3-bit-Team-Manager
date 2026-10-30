import React, { useRef } from 'react';
import {
  Search,
  Coffee,
  LayoutDashboard,
  AlertCircle,
  History,
  Users,
  CalendarDays,
  List,
  UserCheck,
  ArrowLeftRight,
  CalendarOff,
  Clock,
  ClipboardCheck,
  Sparkles,
  MessageSquare,
  CalendarPlus,
  CheckSquare,
  Briefcase,
  SlidersHorizontal,
  Keyboard,
} from 'lucide-react';
import { WorkspaceTab, QuickDrawerType } from './Navigation';
import NotificationCenter from './NotificationCenter';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import { Shift } from '../types';

export interface SubTabOption {
  id: string;
  label: string;
  badge?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface ContextualToolbarProps {
  weekStart: Date;
  onChangeWeekStart: (nextDate: Date) => void;
  shiftTypeFilter: string;
  onChangeShiftTypeFilter: (type: string) => void;
  scheduleSearchQuery: string;
  onChangeScheduleSearchQuery: (q: string) => void;
  requestsStatusFilter:
    | 'all'
    | 'pending'
    | 'accepted'
    | 'approved'
    | 'rejected';
  onChangeRequestsStatusFilter: (
    status: 'all' | 'pending' | 'accepted' | 'approved' | 'rejected'
  ) => void;
  operationsSearchQuery: string;
  onChangeOperationsSearchQuery: (q: string) => void;
  operationsOnlyOnBreak: boolean;
  onChangeOperationsOnlyOnBreak: (val: boolean) => void;
}

interface TopActionBarProps {
  activeTab: WorkspaceTab;
  moduleLabel: string;
  subTabs: SubTabOption[];
  activeSubTab: string;
  onSelectSubTab: (subTabId: string) => void;
  onNavigateModuleSubTab: (tab: WorkspaceTab, subTab: string) => void;
  onOpenQuickDrawer: (drawer: QuickDrawerType) => void;
  onOpenCommandPalette: () => void;
  onOpenShortcutsModal?: () => void;
  onInspectShift?: (shift: Shift) => void;
  toolbar: ContextualToolbarProps;
}

const SUB_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  summary: LayoutDashboard,
  attention: AlertCircle,
  activity: History,
  roster: Users,
  week: CalendarDays,
  list: List,
  mine: UserCheck,
  swaps: ArrowLeftRight,
  leaves: CalendarOff,
  directory: Users,
  tracker: Coffee,
  breaks: Clock,
  handover: ClipboardCheck,
  troubleshooter: Sparkles,
  chat: MessageSquare,
  planner: CalendarPlus,
  approvals: CheckSquare,
  team: Briefcase,
  settings: SlidersHorizontal,
};

const MODULE_ICONS: Record<WorkspaceTab, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  schedule: CalendarDays,
  requests: ArrowLeftRight,
  operations: Users,
  support: MessageSquare,
  admin: SlidersHorizontal,
};

export default function TopActionBar({
  activeTab,
  moduleLabel,
  subTabs,
  activeSubTab,
  onSelectSubTab,
  onNavigateModuleSubTab,
  onOpenQuickDrawer,
  onOpenCommandPalette,
  onOpenShortcutsModal,
  onInspectShift,
}: TopActionBarProps) {
  const { theme, setTheme, setFollowSystem, availableThemes } = useTheme();
  const { profile } = useAuth();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const ModuleIcon = MODULE_ICONS[activeTab] || LayoutDashboard;

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (subTabs.length <= 1) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % subTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + subTabs.length) % subTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = subTabs.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const targetTab = subTabs[nextIndex];
      if (targetTab) {
        onSelectSubTab(targetTab.id);
        tabRefs.current[nextIndex]?.focus();
      }
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-surface-2 border-b border-main-border">
      <div className="h-14 px-2.5 sm:px-6 lg:px-8 flex items-center justify-between gap-2 flex-nowrap min-w-0">
        {/* Zone 1: Module Identity + Icon-Clear Sub-View Strip */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="hidden md:flex items-center gap-2 text-xs sm:text-sm shrink-0">
            <button
              type="button"
              onClick={() => onNavigateModuleSubTab('dashboard', 'summary')}
              aria-label="ShiftSync Overview"
              title="Return to Overview"
              className="icon-nav-btn px-2.5 py-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 font-medium whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5"
            >
              <ModuleIcon className="w-4 h-4 text-primary shrink-0" />
              <span className="font-display font-semibold text-main-text">
                {moduleLabel}
              </span>
            </button>
          </div>

          {subTabs.length > 0 && (
            <div
              role="tablist"
              aria-label={`${moduleLabel} sub-views`}
              className="icon-subview-strip flex items-center gap-1 p-1 rounded-xl bg-surface-1 border border-main-border min-w-0"
            >
              {subTabs.map((tab, idx) => {
                const isSelected = activeSubTab === tab.id;
                const SubIcon =
                  tab.icon || SUB_TAB_ICONS[tab.id] || LayoutDashboard;
                const hasBadge = tab.badge !== undefined && tab.badge > 0;
                const accessibleLabel = hasBadge
                  ? `${tab.label} (${tab.badge})`
                  : tab.label;

                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={accessibleLabel}
                    tabIndex={isSelected ? 0 : -1}
                    title={`${tab.label}${hasBadge ? ` · ${tab.badge}` : ''} (Alt+${idx + 1})`}
                    onClick={() => onSelectSubTab(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    className={`icon-tab-btn group relative inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer select-none ${
                      isSelected
                        ? 'bg-surface-2 text-primary font-semibold border border-primary/35 shadow-xs'
                        : 'text-main-text-muted hover:text-main-text hover:bg-surface-3/70 border border-transparent'
                    }`}
                  >
                    <SubIcon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-primary' : 'text-main-text-muted group-hover:text-main-text'
                      }`}
                    />
                    <span
                      className={`${
                        isSelected ? 'hidden xl:inline' : 'hidden 2xl:inline'
                      } truncate max-w-[120px]`}
                    >
                      {tab.label}
                    </span>
                    {hasBadge && (
                      <span
                        className={`font-mono text-[10px] tabular-nums font-bold px-1 rounded ${
                          isSelected
                            ? 'text-primary bg-primary-subtle'
                            : 'text-secondary'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                    <span
                      role="tooltip"
                      className="icon-tooltip pointer-events-none hidden sm:block"
                    >
                      {tab.label}
                      {hasBadge ? ` · ${tab.badge}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Zone 2: Dedicated Quick-Action Icon Controls & Utilities */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Routine Quick-Action Icon Buttons (Desktop/Tablet Header Strip, plus Active Break on Mobile) */}
          <div
            role="toolbar"
            aria-label="Quick actions"
            className="flex items-center gap-1"
          >
            <button
              type="button"
              onClick={() => onOpenQuickDrawer('break')}
              aria-label={
                profile?.isBreakActive ? 'Active break timer' : 'Break timer'
              }
              title={
                profile?.isBreakActive
                  ? 'Manage active break'
                  : 'Start or log a break'
              }
              className={`icon-action-btn group relative p-2 rounded-lg border cursor-pointer ${
                profile?.isBreakActive
                  ? 'inline-flex items-center gap-1.5 bg-warning-subtle text-warning border-warning/40 font-semibold text-xs'
                  : 'hidden md:inline-flex items-center justify-center bg-surface-1 hover:bg-surface-3 text-main-text-muted hover:text-main-text border-main-border'
              }`}
            >
              <Coffee className="w-4 h-4 shrink-0" />
              {profile?.isBreakActive && (
                <span className="hidden lg:inline text-xs">On Break</span>
              )}
              <span
                role="tooltip"
                className="icon-tooltip pointer-events-none hidden sm:block"
              >
                {profile?.isBreakActive ? 'Active break timer' : 'Break timer'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickDrawer('swap')}
              aria-label="New shift swap"
              title="Offer or swap a shift"
              className="icon-action-btn group relative hidden md:inline-flex items-center justify-center p-2 rounded-lg bg-surface-1 hover:bg-surface-3 text-main-text-muted hover:text-main-text border border-main-border cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4 shrink-0" />
              <span
                role="tooltip"
                className="icon-tooltip pointer-events-none hidden sm:block"
              >
                Swap shift
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickDrawer('leave')}
              aria-label="New leave request"
              title="Request time off"
              className="icon-action-btn group relative hidden md:inline-flex items-center justify-center p-2 rounded-lg bg-surface-1 hover:bg-surface-3 text-main-text-muted hover:text-main-text border border-main-border cursor-pointer"
            >
              <CalendarOff className="w-4 h-4 shrink-0" />
              <span
                role="tooltip"
                className="icon-tooltip pointer-events-none hidden sm:block"
              >
                Request time off
              </span>
            </button>
          </div>

          <span
            aria-hidden="true"
            className="hidden md:inline-block w-px h-5 bg-main-border mx-0.5"
          />

          {/* Search / Command Palette Trigger */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="icon-action-btn group relative p-2 rounded-lg bg-surface-1 hover:bg-surface-3 text-main-text-muted hover:text-main-text border border-main-border cursor-pointer inline-flex items-center justify-center"
            title="Search & Commands (⌘K)"
            aria-label="Open search"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span
              role="tooltip"
              className="icon-tooltip pointer-events-none hidden sm:block"
            >
              Search (⌘K)
            </span>
          </button>

          {/* Keyboard Shortcuts Helper (Desktop) */}
          {onOpenShortcutsModal && (
            <button
              type="button"
              onClick={onOpenShortcutsModal}
              className="icon-action-btn group relative hidden lg:inline-flex items-center justify-center p-2 rounded-lg bg-surface-1 hover:bg-surface-3 text-main-text-muted hover:text-main-text border border-main-border cursor-pointer"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4 shrink-0" />
              <span
                role="tooltip"
                className="icon-tooltip pointer-events-none hidden sm:block"
              >
                Shortcuts (?)
              </span>
            </button>
          )}

          {/* Notification Bell */}
          <NotificationCenter
            onNavigateSubTab={onNavigateModuleSubTab}
            onInspectShift={onInspectShift}
          />

          {/* Theme Mode Selector */}
          <select
            className="theme-select"
            aria-label="Color mode"
            value={theme}
            onChange={(event) => {
              if (event.target.value === 'system') {
                setFollowSystem();
                return;
              }
              const option = availableThemes.find(
                (item) => item.id === event.target.value
              );
              if (option) setTheme(option.id);
            }}
          >
            {availableThemes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
            <option value="system">Follow system</option>
          </select>
        </div>
      </div>
    </header>
  );
}
