import React, { useState, useEffect } from 'react';
import {
  Search,
  LayoutDashboard,
  CalendarDays,
  ArrowLeftRight,
  Users,
  MessageSquare,
  SlidersHorizontal,
  Sun,
  Moon,
  Settings,
  X,
  ArrowRight,
  Coffee,
  CalendarOff,
  Plus,
  Wrench,
  Grid,
  Clock,
  Rows3,
  Maximize2,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { WorkspaceTab, QuickDrawerType } from './Navigation';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  onSelectSubTab?: (tab: WorkspaceTab, subTab: string) => void;
  onOpenQuickDrawer: (drawer: QuickDrawerType) => void;
  isAdmin: boolean;
}

interface CommandItem {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  setActiveTab,
  onSelectSubTab,
  onOpenQuickDrawer,
  isAdmin,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const { isDark, toggleTheme, density, toggleDensity, isZenMode, toggleZenMode } =
    useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigateWithSub = (tab: WorkspaceTab, subTab: string) => {
    setActiveTab(tab);
    if (onSelectSubTab) {
      onSelectSubTab(tab, subTab);
    }
    onClose();
  };

  const commands: CommandItem[] = [
    // Slide-Over Quick Actions
    {
      id: 'act-break',
      label: 'Start or End Rest Break Timer',
      category: 'Quick Action',
      icon: Coffee,
      action: () => {
        onClose();
        onOpenQuickDrawer('break');
      },
    },
    {
      id: 'act-swap',
      label: 'Post a Shift to Swap (Drawer)',
      category: 'Quick Action',
      icon: ArrowLeftRight,
      action: () => {
        onClose();
        onOpenQuickDrawer('swap');
      },
    },
    {
      id: 'act-leave',
      label: 'Submit a Time Off / Leave Request (Drawer)',
      category: 'Quick Action',
      icon: CalendarOff,
      action: () => {
        onClose();
        onOpenQuickDrawer('leave');
      },
    },
    ...(isAdmin
      ? [
          {
            id: 'act-assign-shift',
            label: 'Quick Assign Shift to Team Member (Drawer)',
            category: 'Quick Action',
            icon: Plus,
            action: () => {
              onClose();
              onOpenQuickDrawer('assign-shift');
            },
          },
        ]
      : []),

    // Workspace Views & Sub-Tabs
    {
      id: 'nav-dashboard',
      label: 'Overview · Orbital Chrono-Ring & Daily Check-In',
      category: 'Navigation',
      icon: LayoutDashboard,
      action: () => navigateWithSub('dashboard', 'summary'),
    },
    {
      id: 'nav-schedule-matrix',
      label: 'Schedule · 7-Day Shift Coverage & Fatigue Matrix Heatmap',
      category: 'Navigation',
      icon: Grid,
      action: () => navigateWithSub('schedule', 'matrix'),
    },
    {
      id: 'nav-schedule-list',
      label: 'Schedule · 120fps Enterprise Roster Data Grid',
      category: 'Navigation',
      icon: CalendarDays,
      action: () => navigateWithSub('schedule', 'list'),
    },
    {
      id: 'nav-schedule-timeline',
      label: 'Schedule · 24-Hour Orbital Timeline & Handoff Readiness',
      category: 'Navigation',
      icon: Clock,
      action: () => navigateWithSub('schedule', 'timeline'),
    },
    {
      id: 'nav-schedule-week',
      label: 'Schedule · 7-Day Week Cards',
      category: 'Navigation',
      icon: CalendarDays,
      action: () => navigateWithSub('schedule', 'week'),
    },
    {
      id: 'nav-schedule-mine',
      label: 'Schedule · My Upcoming Shifts Only',
      category: 'Navigation',
      icon: CalendarDays,
      action: () => navigateWithSub('schedule', 'mine'),
    },
    {
      id: 'nav-requests-swaps',
      label: 'Requests · Shift Swap Marketplace',
      category: 'Navigation',
      icon: ArrowLeftRight,
      action: () => navigateWithSub('requests', 'swaps'),
    },
    {
      id: 'nav-requests-leaves',
      label: 'Requests · Leave & Time Off Log',
      category: 'Navigation',
      icon: CalendarOff,
      action: () => navigateWithSub('requests', 'leaves'),
    },
    {
      id: 'nav-ops-dir',
      label: 'Team & Breaks · Live Floor Directory',
      category: 'Navigation',
      icon: Users,
      action: () => navigateWithSub('operations', 'directory'),
    },
    {
      id: 'nav-ops-tracker',
      label: 'Team & Breaks · Live Break Tracker & GPS Radar',
      category: 'Navigation',
      icon: Coffee,
      action: () => navigateWithSub('operations', 'tracker'),
    },
    {
      id: 'nav-ops-breaks',
      label: 'Team & Breaks · Break Compliance History',
      category: 'Navigation',
      icon: Coffee,
      action: () => navigateWithSub('operations', 'breaks'),
    },
    {
      id: 'nav-support-chat',
      label: 'Support · Live Team Channels',
      category: 'Navigation',
      icon: MessageSquare,
      action: () => navigateWithSub('support', 'chat'),
    },
    {
      id: 'nav-support-troubleshoot',
      label: 'Support · L1 Ops & Equipment Troubleshooter',
      category: 'Navigation',
      icon: Wrench,
      action: () => navigateWithSub('support', 'troubleshooter'),
    },
    ...(isAdmin
      ? [
          {
            id: 'nav-admin-planner',
            label: 'Admin · Smart Weekly Auto-Scheduler & CSV Import',
            category: 'Management',
            icon: SlidersHorizontal,
            action: () => navigateWithSub('admin', 'planner'),
          },
          {
            id: 'nav-admin-approvals',
            label: 'Admin · Pending Leave & Swap Approvals',
            category: 'Management',
            icon: SlidersHorizontal,
            action: () => navigateWithSub('admin', 'approvals'),
          },
          {
            id: 'nav-admin-team',
            label: 'Admin · Team Directory & Payroll Estimates',
            category: 'Management',
            icon: Users,
            action: () => navigateWithSub('admin', 'team'),
          },
        ]
      : []),
    {
      id: 'pref-density',
      label:
        density === 'ultra-dense'
          ? 'Switch to Comfort Grid Spacing'
          : 'Switch to 120Hz Ultra-Dense Grid Mode',
      category: 'Display & 120fps',
      icon: Rows3,
      action: () => {
        toggleDensity();
        onClose();
      },
    },
    {
      id: 'pref-zen',
      label: isZenMode
        ? 'Exit Zen Command Focus Mode (Shift+Z)'
        : 'Enter Zen Command Focus Mode (Shift+Z)',
      category: 'Display & 120fps',
      icon: Maximize2,
      action: () => {
        toggleZenMode();
        onClose();
      },
    },
    {
      id: 'pref-settings',
      label: 'Edit Profile, Timezone & Appearance',
      category: 'Preferences',
      icon: Settings,
      action: () => {
        onClose();
        onOpenQuickDrawer('settings');
      },
    },
    {
      id: 'pref-theme',
      label: isDark
        ? 'Switch to Titanium Daylight & Electric Cyan (Light)'
        : 'Switch to Deep Carbon Obsidian & Electric Cyan (Dark)',
      category: 'Preferences',
      icon: isDark ? Sun : Moon,
      action: () => {
        toggleTheme();
        onClose();
      },
    },
  ];

  const filtered = commands.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-2 border border-main-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-main-border">
          <Search className="w-4 h-4 text-primary shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, jump to Matrix Heatmap, or toggle 120Hz mode..."
            className="w-full bg-transparent text-sm text-main-text placeholder:text-main-text-disabled focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-main-text-muted hover:text-main-text cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-main-text-muted">
              No matching commands or views found.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs sm:text-sm text-main-text hover:bg-surface-3 transition-colors group cursor-pointer"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-main-text-muted group-hover:text-primary transition-colors shrink-0" />
                    <span className="truncate font-medium">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-main-text-muted shrink-0 ml-2">
                    <span className="text-[11px] font-mono text-main-text-disabled">
                      {item.category}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
