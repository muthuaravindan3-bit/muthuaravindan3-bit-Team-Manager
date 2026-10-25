import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Settings,
  Coffee,
  ArrowLeftRight,
  CalendarOff,
  Plus,
  Sun,
  Moon,
  ChevronDown,
  Keyboard,
  Sparkles,
  Maximize2,
  Minimize2,
  Rows3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkspaceTab, QuickDrawerType } from './Navigation';
import NotificationCenter from './NotificationCenter';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import { Shift } from '../types';

export interface SubTabOption {
  id: string;
  label: string;
  badge?: number;
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
  onOpenShortcutsModal: () => void;
  onInspectShift?: (shift: Shift) => void;
  isAIChatOpen?: boolean;
  onToggleAIChat?: () => void;
  toolbar: ContextualToolbarProps;
}

export default function TopActionBar({
  moduleLabel,
  subTabs,
  activeSubTab,
  onSelectSubTab,
  onNavigateModuleSubTab,
  onOpenQuickDrawer,
  onOpenCommandPalette,
  onOpenShortcutsModal,
  onInspectShift,
  isAIChatOpen,
  onToggleAIChat,
}: TopActionBarProps) {
  const {
    isDark,
    toggleTheme,
    density,
    toggleDensity,
    isZenMode,
    toggleZenMode,
  } = useTheme();
  const { profile, isAdmin } = useAuth();
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const currentSubTabLabel =
    subTabs.find((s) => s.id === activeSubTab)?.label || '';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setQuickMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-surface-2/95 backdrop-blur-md border-b border-main-border">
      {/* Whisper-Quiet 3-Zone Top Header */}
      <div className="h-14 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
        {/* Zone 1: Clean Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateModuleSubTab('dashboard', 'summary')}
            className="text-main-text-muted hover:text-main-text font-medium whitespace-nowrap transition-colors cursor-pointer"
          >
            ShiftSync
          </button>
          <span className="text-main-text-disabled">/</span>
          <span className="font-display font-semibold text-main-text whitespace-nowrap">
            {moduleLabel}
          </span>
          {currentSubTabLabel && subTabs.length > 1 && (
            <span className="hidden xl:inline-flex items-center gap-2">
              <span className="text-main-text-disabled">/</span>
              <span className="text-main-text-muted whitespace-nowrap">
                {currentSubTabLabel}
              </span>
            </span>
          )}
        </div>

        {/* Zone 2: Segmented Sub-View Switcher */}
        {subTabs.length > 1 && (
          <div
            role="tablist"
            aria-label={`${moduleLabel} views`}
            className="inline-flex items-center rounded-lg bg-surface-1 p-0.5 border border-main-border overflow-x-auto no-scrollbar max-w-full"
          >
            {subTabs.map((tab, idx) => {
              const isSelected = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  title={`Switch to ${tab.label} (Alt+${idx + 1})`}
                  onClick={() => onSelectSubTab(tab.id)}
                  className={`relative px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'text-main-text font-semibold'
                      : 'text-main-text-muted hover:text-main-text'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="topbar-subtab-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 32,
                      }}
                      className="absolute inset-0 rounded-md bg-surface-2 border border-main-border-strong shadow-xs"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="relative z-10 px-1.5 py-0.2 rounded bg-primary-subtle text-primary font-mono text-[10px] tabular-nums font-bold">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Zone 3: Minimalist Global Actions */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto lg:ml-0">
          {profile?.isBreakActive && (
            <button
              type="button"
              onClick={() => onOpenQuickDrawer('break')}
              className="py-1 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 bg-warning-subtle text-warning border border-warning/30 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>On Break</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="lg:hidden p-1.5 rounded-md text-main-text-muted hover:text-main-text hover:bg-surface-3 transition-colors cursor-pointer"
            title="Search (⌘K)"
            aria-label="Open search"
          >
            <Search className="w-4 h-4" />
          </button>

          <NotificationCenter
            onNavigateSubTab={onNavigateModuleSubTab}
            onInspectShift={onInspectShift}
          />

          {onToggleAIChat && (
            <button
              type="button"
              onClick={onToggleAIChat}
              title="Toggle AI Assistant"
              aria-label="Toggle AI Assistant"
              className={`py-1.5 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isAIChatOpen
                  ? 'bg-primary text-primary-text border-primary'
                  : 'bg-surface-1 hover:bg-surface-3 text-main-text-muted hover:text-main-text border-main-border'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">AI Help</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle color theme"
            className="p-1.5 rounded-md text-main-text-muted hover:text-main-text hover:bg-surface-3 transition-colors cursor-pointer"
          >
            {isDark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Consolidated Quick Action Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setQuickMenuOpen((prev) => !prev)}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Quick Action</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            <AnimatePresence>
              {quickMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-1.5 w-52 rounded-lg bg-surface-2 border border-main-border shadow-lg py-1 z-50"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickDrawer('break');
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-main-text hover:bg-surface-3 flex items-center gap-2 cursor-pointer"
                  >
                    <Coffee className="w-3.5 h-3.5 text-main-text-muted" />
                    <span>
                      {profile?.isBreakActive
                        ? 'Manage Break'
                        : 'Start Rest Break'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickDrawer('swap');
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-main-text hover:bg-surface-3 flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-main-text-muted" />
                    <span>Swap a Shift</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickDrawer('leave');
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-main-text hover:bg-surface-3 flex items-center gap-2 cursor-pointer"
                  >
                    <CalendarOff className="w-3.5 h-3.5 text-main-text-muted" />
                    <span>Request Time Off</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickMenuOpen(false);
                        onOpenQuickDrawer('assign-shift');
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-main-text hover:bg-surface-3 flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-main-text-muted" />
                      <span>Assign Team Shift</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-main-border" />

                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      toggleDensity();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-main-text-muted hover:text-main-text hover:bg-surface-3 flex items-center gap-2 cursor-pointer"
                  >
                    <Rows3 className="w-3.5 h-3.5" />
                    <span>
                      {density === 'ultra-dense'
                        ? 'Comfort Row Spacing'
                        : 'Compact Row Spacing'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      toggleZenMode();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-main-text-muted hover:text-main-text hover:bg-surface-3 flex items-center gap-2 cursor-pointer"
                  >
                    {isZenMode ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isZenMode ? 'Exit Zen Focus (⇧Z)' : 'Zen Focus Mode (⇧Z)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickDrawer('settings');
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-main-text-muted hover:text-main-text hover:bg-surface-3 flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Timezone & Preferences</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenShortcutsModal();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-main-text-muted hover:text-main-text hover:bg-surface-3 flex items-center gap-2 cursor-pointer"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Keyboard Shortcuts (?)</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
