import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Coffee,
  Sun,
  Moon,
  ChevronDown,
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
  onOpenShortcutsModal?: () => void;
  onInspectShift?: (shift: Shift) => void;
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
  onInspectShift,
}: TopActionBarProps) {
  const { isDark, toggleTheme, theme, setTheme, availableThemes } = useTheme();
  const { profile } = useAuth();
  const [breadcrumbMenuOpen, setBreadcrumbMenuOpen] = useState(false);
  const breadcrumbRef = useRef<HTMLDivElement | null>(null);

  const currentSubTabLabel =
    subTabs.find((s) => s.id === activeSubTab)?.label || '';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        breadcrumbRef.current &&
        !breadcrumbRef.current.contains(e.target as Node)
      ) {
        setBreadcrumbMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-surface-2/95 backdrop-blur-xl border-b border-main-border">
      {/* Single-Row Top Bar (Breadcrumb with Sub-Menu Dropdown on Left, Utilities on Right) */}
      <div className="h-14 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 flex-nowrap">
        {/* Zone 1: Interactive Breadcrumb with Sub-Menu Dropdown Switcher */}
        <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
          <button
            type="button"
            onClick={() => onNavigateModuleSubTab('dashboard', 'summary')}
            className="text-main-text-muted hover:text-primary font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            ShiftSync
          </button>
          <span className="text-main-text-disabled shrink-0">/</span>
          <span className="font-display font-semibold text-main-text truncate">
            {moduleLabel}
          </span>

          {currentSubTabLabel && subTabs.length > 1 && (
            <div
              className="relative flex items-center gap-2 shrink-0"
              ref={breadcrumbRef}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setBreadcrumbMenuOpen(false);
                }
              }}
            >
              <span className="text-main-text-disabled">/</span>
              <button
                type="button"
                onClick={() => setBreadcrumbMenuOpen((prev) => !prev)}
                aria-expanded={breadcrumbMenuOpen}
                aria-label="Switch sub-view"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-3/60 hover:bg-surface-3 text-main-text border border-main-border/80 transition-colors cursor-pointer"
              >
                <span className="truncate max-w-[130px] sm:max-w-none">
                  {currentSubTabLabel}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-main-text-muted transition-transform duration-150 shrink-0 ${
                    breadcrumbMenuOpen ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {breadcrumbMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    className="absolute left-2 top-full mt-1.5 w-52 rounded-xl bg-surface-2 border border-main-border shadow-xl py-1.5 z-50"
                  >
                    <div className="px-3 py-1 text-[10px] font-medium text-main-text-muted border-b border-main-border mb-1">
                      {moduleLabel} sub-menu
                    </div>
                    {subTabs.map((tab) => {
                      const isSelected = activeSubTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            onSelectSubTab(tab.id);
                            setBreadcrumbMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-primary-subtle text-primary font-semibold'
                              : 'text-main-text-muted hover:text-main-text hover:bg-surface-3'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-primary' : 'bg-main-border'
                              }`}
                            />
                            <span>{tab.label}</span>
                          </span>
                          {tab.badge !== undefined && tab.badge > 0 && (
                            <span className="font-mono text-[10px] tabular-nums text-secondary font-bold">
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Zone 2: Essential Header Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Active Break Indicator (only shown when currently on break) */}
          {profile?.isBreakActive && (
            <button
              type="button"
              onClick={() => onOpenQuickDrawer('break')}
              className="py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-warning-subtle text-warning border border-warning/30 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">On Break</span>
            </button>
          )}

          {/* Search Button */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="p-2 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 transition-colors cursor-pointer"
            title="Search (⌘K)"
            aria-label="Open search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notification Bell */}
          <NotificationCenter
            onNavigateSubTab={onNavigateModuleSubTab}
            onInspectShift={onInspectShift}
          />

          {/* Theme Toggle */}
          <select className="theme-select" aria-label="Color mode" value={theme} onChange={(event) => { const option=availableThemes.find((item)=>item.id===event.target.value);if(option)setTheme(option.id); }}>{availableThemes.map((option)=><option key={option.id} value={option.id}>{option.name}</option>)}</select>
        </div>
      </div>
    </header>
  );
}
