import { useModalFocus } from '../hooks/useModalFocus';
import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  ArrowLeftRight,
  Users,
  MessageSquare,
  SlidersHorizontal,
  LogOut,
  Search,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { useTimezone } from '../TimezoneContext';

export type WorkspaceTab =
  | 'dashboard'
  | 'schedule'
  | 'requests'
  | 'operations'
  | 'support'
  | 'admin';

export type QuickDrawerType =
  | 'swap'
  | 'leave'
  | 'break'
  | 'assign-shift'
  | 'settings'
  | 'inspect-shift'
  | null;

export interface SubMenuItemConfig {
  id: string;
  label: string;
  badge?: number;
}

interface NavigationProps {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  activeSubTab: string;
  onSelectModuleSubTab: (tab: WorkspaceTab, subTab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenQuickDrawer: (drawer: QuickDrawerType) => void;
  onOpenCommandPalette: () => void;
  onOpenShortcutsModal?: () => void;
  pendingSwapsCount?: number;
  pendingLeavesCount?: number;
  activeBreaksCount?: number;
  openIncidentsCount?: number;
}

interface NavModuleItem {
  id: WorkspaceTab;
  label: string;
  shortLabel: string;
  defaultSubTab: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export default function Navigation({
  activeTab,
  setActiveTab,
  onSelectModuleSubTab,
  isCollapsed,
  onToggleCollapse,
  onOpenQuickDrawer,
  onOpenCommandPalette,
  pendingSwapsCount = 0,
  pendingLeavesCount = 0,
  activeBreaksCount = 0,
  openIncidentsCount = 0,
}: NavigationProps) {
  const { user, profile, isAdmin, logout } = useAuth();
  const { userTimezone } = useTimezone();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const totalPendingRequests = pendingSwapsCount + pendingLeavesCount;

  const mobileRef = useModalFocus<HTMLDivElement>(mobileMenuOpen, () => setMobileMenuOpen(false));
  const navItems: NavModuleItem[] = [
    {
      id: 'dashboard',
      label: 'Overview',
      shortLabel: 'Overview',
      defaultSubTab: 'summary',
      icon: LayoutDashboard,
    },
    {
      id: 'schedule',
      label: 'Schedule',
      shortLabel: 'Schedule',
      defaultSubTab: 'week',
      icon: CalendarDays,
    },
    {
      id: 'requests',
      label: 'Requests',
      shortLabel: 'Requests',
      defaultSubTab: 'swaps',
      icon: ArrowLeftRight,
      badge: totalPendingRequests > 0 ? totalPendingRequests : undefined,
    },
    {
      id: 'operations',
      label: 'Team',
      shortLabel: 'Team',
      defaultSubTab: 'directory',
      icon: Users,
      badge: activeBreaksCount > 0 ? activeBreaksCount : undefined,
    },
    {
      id: 'support',
      label: 'Support',
      shortLabel: 'Support',
      defaultSubTab: 'troubleshooter',
      icon: MessageSquare,
      badge: openIncidentsCount > 0 ? openIncidentsCount : undefined,
    },
    ...(isAdmin
      ? [
          {
            id: 'admin' as WorkspaceTab,
            label: 'Admin',
            shortLabel: 'Admin',
            defaultSubTab: 'planner',
            icon: SlidersHorizontal,
            badge: totalPendingRequests > 0 ? totalPendingRequests : undefined,
          },
        ]
      : []),
  ];

  const displayName =
    profile?.displayName || user?.displayName || 'Team Member';
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const shortTz =
    userTimezone.split('/').pop()?.replace(/_/g, ' ') || userTimezone;

  const handleNavigate = (item: NavModuleItem) => {
    setActiveTab(item.id);
    onSelectModuleSubTab(item.id, item.defaultSubTab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Frosted Glass Sidebar (236px expanded / 68px collapsed rail) */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 bg-surface-2 backdrop-blur-xl border-r border-main-border z-30 select-none transition-[width] duration-200 ${
          isCollapsed ? 'lg:w-[68px]' : 'lg:w-[236px]'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-14 flex items-center border-b border-main-border ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => onSelectModuleSubTab('dashboard', 'summary')}
              className="flex items-center gap-2.5 text-left focus:outline-none group min-w-0 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-text font-bold text-xs shrink-0 shadow-xs ring-1 ring-secondary/30">
                SS
              </div>
              <div className="min-w-0">
                <span className="font-display font-bold text-sm text-main-text tracking-tight truncate block">
                  ShiftSync
                </span>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            title={
              isCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'
            }
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick Search / Command Trigger */}
        <div
          className={`px-3 pt-3 pb-1 ${
            isCollapsed ? 'flex justify-center' : ''
          }`}
        >
          <button
            type="button"
            onClick={onOpenCommandPalette}
            title="Search or jump to view (⌘K)"
            className={`w-full flex items-center rounded-xl bg-surface-1 hover:bg-surface-3/70 border border-main-border hover:border-primary/40 text-xs text-main-text-muted transition-opacity cursor-pointer ${
              isCollapsed
                ? 'justify-center p-2'
                : 'justify-between px-3 py-2'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0 text-primary" />
              {!isCollapsed && <span>Jump to...</span>}
            </span>
            {!isCollapsed && (
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-main-text-muted">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Primary Workspace Links with Spring Sliding Pill */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="flex-1 px-3 py-3 space-y-1 overflow-y-auto"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item)}
                title={isCollapsed ? item.label : undefined}
                className={`relative w-full flex items-center rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isCollapsed
                    ? 'justify-center p-2.5'
                    : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-main-text-muted hover:text-main-text hover:bg-surface-3/50'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 32,
                    }}
                    className="absolute inset-0 rounded-xl bg-primary-subtle border border-primary/25 shadow-xs"
                  />
                )}

                <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                      isActive
                        ? 'text-primary scale-105'
                        : 'text-main-text-muted'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </span>

                {!isCollapsed &&
                  item.badge !== undefined &&
                  item.badge > 0 && (
                    <span className="relative z-10 px-1.5 py-0.5 rounded-md bg-secondary-subtle border border-secondary/25 font-mono text-[10px] tabular-nums text-secondary font-bold">
                      {item.badge}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>

        {/* Quiet User Profile Footer */}
        <div className="p-3 border-t border-main-border">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenQuickDrawer('settings')}
                title={`${displayName} · Settings`}
                className="w-8 h-8 rounded-full bg-surface-3 border border-main-border flex items-center justify-center text-xs font-semibold text-main-text hover:border-primary transition-colors cursor-pointer"
              >
                {initials}
              </button>
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded-lg text-main-text-muted hover:text-error transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onOpenQuickDrawer('settings')}
                title="Open profile & timezone preferences"
                className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-primary-subtle border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary shrink-0 group-hover:border-primary transition-colors">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-main-text truncate group-hover:text-primary transition-colors">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-main-text-muted truncate font-mono tabular-nums">
                    {shortTz}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenQuickDrawer('settings')}
                  title="Preferences & Timezone"
                  aria-label="Preferences"
                  className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-1.5 rounded-lg text-main-text-muted hover:text-error hover:bg-error-subtle transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (<= 5 primary destinations) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-surface-2/95 backdrop-blur-xl border-t border-main-border z-30 flex items-center justify-around px-2"
      >
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                isActive ? 'text-primary font-semibold' : 'text-main-text-muted'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="whitespace-nowrap">{item.shortLabel}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[11px] font-medium text-main-text-muted hover:text-main-text cursor-pointer"
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile Slide-Over Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
            onClick={() => setMobileMenuOpen(false)}
            ref={mobileRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            data-focus-scope="modal"
            tabIndex={-1}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              className="w-72 max-w-full bg-surface-2 backdrop-blur-xl h-full border-l border-main-border flex flex-col justify-between p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-main-border">
                  <span className="font-display font-bold text-sm text-main-text">
                    ShiftSync Menu
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text cursor-pointer"
                    aria-label="Close mobile menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer ${
                          isActive
                            ? 'bg-primary-subtle text-primary font-semibold border border-primary/25'
                            : 'text-main-text-muted hover:text-main-text hover:bg-surface-3'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="font-mono text-xs tabular-nums text-secondary font-bold">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-main-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenQuickDrawer('settings');
                  }}
                  className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-subtle border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-main-text truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-main-text-muted truncate font-mono">
                      {shortTz}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="p-2 rounded-lg text-main-text-muted hover:text-error cursor-pointer"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
