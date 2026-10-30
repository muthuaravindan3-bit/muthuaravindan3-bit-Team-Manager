import { useModalFocus } from '../hooks/useModalFocus';
import React, { useState, useEffect } from 'react';
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
  ChevronDown,
  ChevronRight,
  Coffee,
  CalendarOff,
  Plus,
  Keyboard,
  AlertCircle,
  History,
  List,
  UserCheck,
  Clock,
  ClipboardCheck,
  Sparkles,
  CalendarPlus,
  CheckSquare,
  Briefcase,
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
  icon?: React.ComponentType<{ className?: string }>;
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
  subItems: SubMenuItemConfig[];
}

export default function Navigation({
  activeTab,
  setActiveTab,
  activeSubTab,
  onSelectModuleSubTab,
  isCollapsed,
  onToggleCollapse,
  onOpenQuickDrawer,
  onOpenCommandPalette,
  onOpenShortcutsModal,
  pendingSwapsCount = 0,
  pendingLeavesCount = 0,
  activeBreaksCount = 0,
  openIncidentsCount = 0,
}: NavigationProps) {
  const { user, profile, isAdmin, logout } = useAuth();
  const { userTimezone } = useTimezone();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    [activeTab]: true,
  });
  const [mobileSubMenuModule, setMobileSubMenuModule] =
    useState<WorkspaceTab | null>(null);

  useEffect(() => {
    setExpandedModules((prev) => ({
      ...prev,
      [activeTab]: true,
    }));
  }, [activeTab]);

  const totalPendingRequests = pendingSwapsCount + pendingLeavesCount;
  const totalAttentionCount = totalPendingRequests + openIncidentsCount;

  const mobileRef = useModalFocus<HTMLDivElement>(mobileMenuOpen, () =>
    setMobileMenuOpen(false)
  );

  const navItems: NavModuleItem[] = [
    {
      id: 'dashboard',
      label: 'Overview',
      shortLabel: 'Overview',
      defaultSubTab: 'summary',
      icon: LayoutDashboard,
      badge: totalAttentionCount > 0 ? totalAttentionCount : undefined,
      subItems: [
        { id: 'summary', label: 'Summary', icon: LayoutDashboard },
        {
          id: 'attention',
          label: 'Needs attention',
          badge: totalAttentionCount > 0 ? totalAttentionCount : undefined,
          icon: AlertCircle,
        },
        { id: 'activity', label: 'Personal activity', icon: History },
        { id: 'roster', label: "Today's roster", icon: Users },
      ],
    },
    {
      id: 'schedule',
      label: 'Schedule',
      shortLabel: 'Schedule',
      defaultSubTab: 'week',
      icon: CalendarDays,
      subItems: [
        { id: 'week', label: 'Week', icon: CalendarDays },
        { id: 'list', label: 'List', icon: List },
        { id: 'mine', label: 'My week', icon: UserCheck },
      ],
    },
    {
      id: 'requests',
      label: 'Requests',
      shortLabel: 'Requests',
      defaultSubTab: 'swaps',
      icon: ArrowLeftRight,
      badge: totalPendingRequests > 0 ? totalPendingRequests : undefined,
      subItems: [
        {
          id: 'swaps',
          label: 'Shift Swaps',
          badge: pendingSwapsCount > 0 ? pendingSwapsCount : undefined,
          icon: ArrowLeftRight,
        },
        {
          id: 'leaves',
          label: 'Leave Requests',
          badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined,
          icon: CalendarOff,
        },
      ],
    },
    {
      id: 'operations',
      label: 'Team',
      shortLabel: 'Team',
      defaultSubTab: 'directory',
      icon: Users,
      badge: activeBreaksCount > 0 ? activeBreaksCount : undefined,
      subItems: [
        { id: 'directory', label: 'People', icon: Users },
        {
          id: 'tracker',
          label: 'Active breaks',
          badge: activeBreaksCount > 0 ? activeBreaksCount : undefined,
          icon: Coffee,
        },
        { id: 'breaks', label: 'Break Logs', icon: Clock },
        {
          id: 'handover',
          label: 'Shift Handover Board',
          badge: openIncidentsCount > 0 ? openIncidentsCount : undefined,
          icon: ClipboardCheck,
        },
      ],
    },
    {
      id: 'support',
      label: 'Support',
      shortLabel: 'Support',
      defaultSubTab: 'troubleshooter',
      icon: MessageSquare,
      badge: openIncidentsCount > 0 ? openIncidentsCount : undefined,
      subItems: [
        { id: 'troubleshooter', label: 'AI Troubleshooter', icon: Sparkles },
        {
          id: 'handover',
          label: 'Shift Handover',
          badge: openIncidentsCount > 0 ? openIncidentsCount : undefined,
          icon: ClipboardCheck,
        },
        { id: 'chat', label: 'Team Chat', icon: MessageSquare },
      ],
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
            subItems: [
              {
                id: 'planner',
                label: 'Schedule Planner',
                icon: CalendarPlus,
              },
              {
                id: 'approvals',
                label: 'Approvals Queue',
                badge:
                  totalPendingRequests > 0 ? totalPendingRequests : undefined,
                icon: CheckSquare,
              },
              { id: 'team', label: 'Team & Payroll', icon: Briefcase },
              {
                id: 'settings',
                label: 'Settings & Audit',
                icon: SlidersHorizontal,
              },
            ],
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

  const handleNavigateModule = (item: NavModuleItem) => {
    if (activeTab === item.id) {
      setExpandedModules((prev) => ({
        ...prev,
        [item.id]: !prev[item.id],
      }));
    } else {
      setActiveTab(item.id);
      onSelectModuleSubTab(item.id, item.defaultSubTab);
      setExpandedModules((prev) => ({
        ...prev,
        [item.id]: true,
      }));
    }
  };

  const handleNavigateSubItem = (
    moduleId: WorkspaceTab,
    subTabId: string
  ) => {
    setActiveTab(moduleId);
    onSelectModuleSubTab(moduleId, subTabId);
    setMobileSubMenuModule(null);
    setMobileMenuOpen(false);
  };

  const toggleExpandModule = (e: React.MouseEvent, moduleId: WorkspaceTab) => {
    e.stopPropagation();
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  return (
    <>
      {/* Desktop Tactile Sidebar (236px expanded / 68px icon rail) */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 bg-surface-2 border-r border-main-border z-30 select-none ${
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
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-text font-bold text-xs shrink-0 shadow-xs ring-1 ring-primary/30">
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
            className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 cursor-pointer inline-flex items-center justify-center"
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
            aria-label="Search or jump to view"
            className={`group relative w-full flex items-center rounded-xl bg-surface-1 hover:bg-surface-3/70 border border-main-border hover:border-primary/40 text-xs text-main-text-muted cursor-pointer ${
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

        {/* Primary Workspace Links with Icon-Clear Sub-Menus */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto overflow-x-visible"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isExpanded = Boolean(expandedModules[item.id]);

            return (
              <div key={item.id} className="relative">
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => handleNavigateModule(item)}
                    title={
                      isCollapsed
                        ? `${item.label}${item.badge ? ` (${item.badge})` : ''}`
                        : undefined
                    }
                    aria-label={isCollapsed ? item.label : undefined}
                    aria-expanded={!isCollapsed ? isExpanded : undefined}
                    className={`group relative w-full flex items-center rounded-xl text-xs font-medium cursor-pointer ${
                      isCollapsed
                        ? 'justify-center p-2.5'
                        : 'justify-between pl-3 pr-2 py-2.5'
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
                        className="absolute inset-0 rounded-xl bg-primary-subtle border border-primary/30 shadow-xs"
                      />
                    )}

                    <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-primary' : 'text-main-text-muted group-hover:text-main-text'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </span>

                    {isCollapsed &&
                      item.badge !== undefined &&
                      item.badge > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary z-10" />
                      )}

                    {!isCollapsed && (
                      <span className="relative z-10 flex items-center gap-1.5">
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="font-mono text-[10px] tabular-nums text-secondary font-bold">
                            {item.badge}
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => toggleExpandModule(e, item.id)}
                          className="p-0.5 rounded hover:bg-surface-3/80 text-main-text-muted hover:text-main-text"
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label} sub-menu`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </span>
                    )}
                  </button>
                </div>

                {/* Expanded Sidebar Nested Sub-Menu Tree with Icons */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && isExpanded && item.subItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.14 }}
                      role="group"
                      aria-label={`${item.label} sub-menu`}
                      className="mt-1 ml-3.5 pl-2.5 border-l border-main-border space-y-0.5"
                    >
                      {item.subItems.map((sub) => {
                        const isSubActive =
                          isActive && activeSubTab === sub.id;
                        const SubIcon = sub.icon;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() =>
                              handleNavigateSubItem(item.id, sub.id)
                            }
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                              isSubActive
                                ? 'bg-surface-3 text-primary font-semibold border border-primary/20'
                                : 'text-main-text-muted hover:text-main-text hover:bg-surface-3/40 border border-transparent'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              {SubIcon ? (
                                <SubIcon
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isSubActive
                                      ? 'text-primary'
                                      : 'text-main-text-muted'
                                  }`}
                                />
                              ) : (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isSubActive
                                      ? 'bg-primary'
                                      : 'bg-main-border'
                                  }`}
                                />
                              )}
                              <span className="truncate">{sub.label}</span>
                            </span>
                            {sub.badge !== undefined && sub.badge > 0 && (
                              <span className="font-mono text-[10px] tabular-nums text-secondary font-semibold ml-1.5">
                                {sub.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Quick Actions Section in Desktop Sidebar (Expanded & Collapsed Icon Rail) */}
          <div className="pt-3 mt-3 border-t border-main-border space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[11px] font-medium text-main-text-muted">
                Quick actions
              </p>
            )}
            <button
              type="button"
              onClick={() => onOpenQuickDrawer('break')}
              title={
                profile?.isBreakActive ? 'Active break timer' : 'Break timer'
              }
              aria-label={
                isCollapsed
                  ? profile?.isBreakActive
                    ? 'Active break timer'
                    : 'Break timer'
                  : undefined
              }
              className={`w-full flex items-center rounded-lg text-xs text-main-text-muted hover:text-main-text hover:bg-surface-3/50 cursor-pointer ${
                isCollapsed
                  ? 'justify-center p-2.5'
                  : 'justify-between px-3 py-1.5'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Coffee className="w-3.5 h-3.5 text-primary shrink-0" />
                {!isCollapsed && (
                  <span>
                    {profile?.isBreakActive
                      ? 'Active break timer'
                      : 'Break timer'}
                  </span>
                )}
              </span>
              {!isCollapsed && profile?.isBreakActive && (
                <span className="w-2 h-2 rounded-full bg-warning" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onOpenQuickDrawer('swap')}
              title="New shift swap"
              aria-label={isCollapsed ? 'New shift swap' : undefined}
              className={`w-full flex items-center rounded-lg text-xs text-main-text-muted hover:text-main-text hover:bg-surface-3/50 cursor-pointer ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-1.5'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-primary shrink-0" />
              {!isCollapsed && <span>New shift swap</span>}
            </button>
            <button
              type="button"
              onClick={() => onOpenQuickDrawer('leave')}
              title="New leave request"
              aria-label={isCollapsed ? 'New leave request' : undefined}
              className={`w-full flex items-center rounded-lg text-xs text-main-text-muted hover:text-main-text hover:bg-surface-3/50 cursor-pointer ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-1.5'
              }`}
            >
              <CalendarOff className="w-3.5 h-3.5 text-primary shrink-0" />
              {!isCollapsed && <span>New leave request</span>}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onOpenQuickDrawer('assign-shift')}
                title="Assign team shift"
                aria-label={isCollapsed ? 'Assign team shift' : undefined}
                className={`w-full flex items-center rounded-lg text-xs text-main-text-muted hover:text-main-text hover:bg-surface-3/50 cursor-pointer ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-1.5'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                {!isCollapsed && <span>Assign team shift</span>}
              </button>
            )}
          </div>
        </nav>

        {/* Quiet User Profile Footer */}
        <div className="p-3 border-t border-main-border">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenQuickDrawer('settings')}
                title={`${displayName} · Preferences`}
                aria-label="Preferences"
                className="w-8 h-8 rounded-full bg-surface-3 border border-main-border flex items-center justify-center text-xs font-semibold text-main-text hover:border-primary cursor-pointer"
              >
                {initials}
              </button>
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded-lg text-main-text-muted hover:text-error cursor-pointer inline-flex items-center justify-center"
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
                <div className="w-8 h-8 rounded-full bg-primary-subtle border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary shrink-0 group-hover:border-primary">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-main-text truncate group-hover:text-primary">
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
                  className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 cursor-pointer inline-flex items-center justify-center"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-1.5 rounded-lg text-main-text-muted hover:text-error hover:bg-error-subtle cursor-pointer inline-flex items-center justify-center"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Upward Sub-Menu Popover above Bottom Navigation Bar */}
      <AnimatePresence>
        {mobileSubMenuModule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="lg:hidden fixed inset-0 z-30 bg-black/40"
            onClick={() => setMobileSubMenuModule(null)}
          >
            {(() => {
              const targetModule = navItems.find(
                (m) => m.id === mobileSubMenuModule
              );
              if (!targetModule) return null;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.16 }}
                  onClick={(e) => e.stopPropagation()}
                  className="fixed bottom-16 inset-x-3 rounded-2xl bg-surface-2 border border-main-border shadow-xl p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between px-2 pb-1.5 border-b border-main-border">
                    <span className="font-display font-bold text-xs text-main-text">
                      {targetModule.label} views
                    </span>
                    <button
                      type="button"
                      onClick={() => setMobileSubMenuModule(null)}
                      aria-label="Close sub-menu"
                      className="p-1 rounded-lg text-main-text-muted hover:text-main-text cursor-pointer inline-flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {targetModule.subItems.map((sub) => {
                      const isSubActive =
                        activeTab === targetModule.id &&
                        activeSubTab === sub.id;
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() =>
                            handleNavigateSubItem(targetModule.id, sub.id)
                          }
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer ${
                            isSubActive
                              ? 'bg-primary-subtle text-primary font-semibold border border-primary/25'
                              : 'text-main-text-muted hover:text-main-text hover:bg-surface-3 border border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {SubIcon ? (
                              <SubIcon className="w-4 h-4 shrink-0" />
                            ) : (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isSubActive ? 'bg-primary' : 'bg-main-border'
                                }`}
                              />
                            )}
                            <span>{sub.label}</span>
                          </span>
                          {sub.badge !== undefined && sub.badge > 0 && (
                            <span className="font-mono text-[11px] tabular-nums text-secondary font-bold">
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Bar (5 Icon-Clear Destinations: Overview, Schedule, Requests, Team, More) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-surface-2 border-t border-main-border z-30 flex items-center justify-around px-1"
      >
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (isActive && item.subItems.length > 1) {
                  setMobileSubMenuModule((prev) =>
                    prev === item.id ? null : item.id
                  );
                } else {
                  setMobileSubMenuModule(null);
                  handleNavigateSubItem(item.id, item.defaultSubTab);
                }
              }}
              aria-label={item.shortLabel}
              className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[11px] font-medium cursor-pointer ${
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-main-text-muted hover:text-main-text'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5 shrink-0" />
              <span className="whitespace-nowrap flex items-center gap-0.5 leading-tight">
                <span>{item.shortLabel}</span>
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-secondary" />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setMobileSubMenuModule(null);
            setMobileMenuOpen(true);
          }}
          aria-expanded={mobileMenuOpen}
          aria-label="More navigation and actions"
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[11px] font-medium cursor-pointer ${
            mobileMenuOpen ||
            activeTab === 'support' ||
            activeTab === 'admin'
              ? 'text-primary font-semibold'
              : 'text-main-text-muted hover:text-main-text'
          }`}
        >
          <Menu className="w-4 h-4 mb-0.5 shrink-0" />
          <span className="leading-tight">
            {activeTab === 'support'
              ? 'Support'
              : activeTab === 'admin'
                ? 'Admin'
                : 'More'}
          </span>
        </button>
      </nav>

      {/* Mobile Slide-Over Menu & Sub-Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/55 flex justify-end"
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
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="w-80 max-w-full bg-surface-2 h-full border-l border-main-border flex flex-col justify-between p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-main-border">
                  <div>
                    <span className="font-display font-bold text-sm text-main-text block">
                      Workspace Navigation
                    </span>
                    <span className="text-[11px] text-main-text-muted">
                      Select a module or sub-view
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text cursor-pointer inline-flex items-center justify-center"
                    aria-label="Close mobile menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Hierarchical Mobile Accordion Sub-Menus */}
                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const isExpanded = Boolean(expandedModules[item.id]);

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-main-border bg-surface-1 overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              handleNavigateSubItem(
                                item.id,
                                item.defaultSubTab
                              )
                            }
                            className={`flex-1 flex items-center justify-between px-3 py-2.5 text-xs font-medium cursor-pointer ${
                              isActive
                                ? 'text-primary font-semibold'
                                : 'text-main-text hover:bg-surface-3/50'
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Icon className="w-4 h-4 shrink-0" />
                              <span>{item.label}</span>
                            </span>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="font-mono text-xs tabular-nums text-secondary font-bold mr-1">
                                {item.badge}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => toggleExpandModule(e, item.id)}
                            aria-expanded={isExpanded}
                            aria-label={`Toggle ${item.label} sub-menu`}
                            className="px-3 py-2.5 text-main-text-muted hover:text-main-text border-l border-main-border cursor-pointer inline-flex items-center justify-center"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {isExpanded && item.subItems.length > 0 && (
                          <div className="px-2 pb-2 pt-1 border-t border-main-border bg-surface-2 space-y-0.5">
                            {item.subItems.map((sub) => {
                              const isSubActive =
                                isActive && activeSubTab === sub.id;
                              const SubIcon = sub.icon;
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() =>
                                    handleNavigateSubItem(item.id, sub.id)
                                  }
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer ${
                                    isSubActive
                                      ? 'bg-primary-subtle text-primary font-semibold'
                                      : 'text-main-text-muted hover:text-main-text hover:bg-surface-3'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    {SubIcon ? (
                                      <SubIcon className="w-3.5 h-3.5 shrink-0" />
                                    ) : (
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          isSubActive
                                            ? 'bg-primary'
                                            : 'bg-main-border'
                                        }`}
                                      />
                                    )}
                                    <span>{sub.label}</span>
                                  </span>
                                  {sub.badge !== undefined && sub.badge > 0 && (
                                    <span className="font-mono text-[11px] tabular-nums text-secondary font-bold">
                                      {sub.badge}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quick Actions Sub-Menu in Mobile Drawer */}
                <div className="pt-3 border-t border-main-border space-y-1">
                  <p className="px-1 text-[11px] font-medium text-main-text-muted">
                    Quick actions
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenQuickDrawer('break');
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-1 border border-main-border text-xs font-medium text-main-text hover:bg-surface-3 cursor-pointer"
                    >
                      <Coffee className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">
                        {profile?.isBreakActive ? 'Manage break' : 'Start break'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenQuickDrawer('swap');
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-1 border border-main-border text-xs font-medium text-main-text hover:bg-surface-3 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">Swap shift</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenQuickDrawer('leave');
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-1 border border-main-border text-xs font-medium text-main-text hover:bg-surface-3 cursor-pointer"
                    >
                      <CalendarOff className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">Time off</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onOpenQuickDrawer('assign-shift');
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-1 border border-main-border text-xs font-medium text-main-text hover:bg-surface-3 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">Assign shift</span>
                      </button>
                    )}
                    {onOpenShortcutsModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onOpenShortcutsModal();
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-1 border border-main-border text-xs font-medium text-main-text-muted hover:text-main-text hover:bg-surface-3 cursor-pointer"
                      >
                        <Keyboard className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Shortcuts</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-main-border flex items-center justify-between">
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
                  className="p-2 rounded-lg text-main-text-muted hover:text-error cursor-pointer inline-flex items-center justify-center"
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
