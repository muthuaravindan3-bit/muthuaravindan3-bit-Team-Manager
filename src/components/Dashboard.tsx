import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useDeferredValue,
  startTransition,
  useRef,
} from 'react';
import {
  TableVirtuoso,
  Virtuoso,
  TableVirtuosoHandle,
} from 'react-virtuoso';
import {
  collection,
  query,
  onSnapshot,
  doc,
  writeBatch,
  deleteDoc,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useTimezone } from '../TimezoneContext';
import { useTheme } from '../ThemeContext';
import { useToast } from '../ToastContext';
import {
  Shift,
  UserProfile,
  LeaveRequest,
  Announcement,
  IncidentTicket,
} from '../types';
import { WorkspaceTab, QuickDrawerType } from './Navigation';
import OrbitalChronoRing from './OrbitalChronoRing';
import CoverageFatigueMatrix from './CoverageFatigueMatrix';
import { ShiftMigrationModal } from './admin/ShiftMigrationModal';
import {
  SHIFT_PRESETS,
  ShiftCategory,
  LocalizedShiftRecord,
  OperatorWorkloadStats,
  categorizeShiftType,
  isTimeOffShift,
  getPresetForShiftType,
  getNextCycledShiftPreset,
  getRotatedShiftType,
  getShiftBadgeStyle,
  computeShiftDurationHours,
  computeMiniBarSegments,
  computeActiveShiftProgress,
  computeOperatorWorkloadMap,
  buildShiftIndexMap,
  solveAutonomousWeekSchedule,
  rankCoverCandidates,
  formatSecondaryTimezoneWindow,
  getInitials,
  downloadShiftsCSV,
  downloadShiftsICS,
} from '../utils/shiftTaxonomy';
import {
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  CalendarPlus,
  CheckSquare,
  Square,
  Trash2,
  ArrowUpDown,
  Users,
  Plus,
  RotateCw,
  ShieldAlert,
  Globe,
  FlaskConical,
  UserCheck,
  Check,
  X,
  Cpu,
  Flame,
  SlidersHorizontal,
  Database,
} from 'lucide-react';
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
} from 'date-fns';

export interface DashboardProps {
  mode: 'overview' | 'schedule';
  subTab: string;
  onNavigate?: (tab: WorkspaceTab) => void;
  onNavigateModuleSubTab?: (tab: WorkspaceTab, subTabId?: string) => void;
  onSelectSubTab?: (subTabId: string) => void;
  onOpenQuickDrawer?: (drawer: QuickDrawerType) => void;
  onInspectShift?: (shift: Shift) => void;
  externalWeekStart?: Date;
  onChangeExternalWeekStart?: (date: Date) => void;
  externalTypeFilter?: string;
  onChangeExternalTypeFilter?: (filter: string) => void;
  externalSearchQuery?: string;
  onChangeExternalSearchQuery?: (q: string) => void;
}

type RosterDateScope = 'week' | 'today' | 'upcoming' | 'all';
type RosterSortField = 'date' | 'operator' | 'shiftType' | 'duration';

interface StagedShiftEdit {
  type: string;
  startTime: string;
  endTime: string;
}

interface RosterRowItemProps {
  shift: LocalizedShiftRecord;
  isCurrentUser: boolean;
  isAdmin: boolean;
  isSelected: boolean;
  isKeyboardFocused: boolean;
  isPopoverOpen: boolean;
  isFinderOpen: boolean;
  isStagedInSandbox: boolean;
  todayStr: string;
  nowMinutes: number;
  userTimezone: string;
  secondaryTimezone: string;
  onToggleSelect: (id: string) => void;
  onInspectShift?: (shift: Shift) => void;
  onOpenPopover: (shiftId: string | null) => void;
  onApplyPresetToShift: (shift: LocalizedShiftRecord, presetId: string) => void;
  onOpenCoverFinder: (shiftId: string | null) => void;
}

// Memoized 5-Column Cells for TableVirtuoso (Checkbox, Operator, Date, Shift Badge, Hours + Slim Bar)
const RosterTableRowCells = React.memo<RosterRowItemProps>(
  ({
    shift,
    isCurrentUser,
    isAdmin,
    isSelected,
    isPopoverOpen,
    isFinderOpen,
    isStagedInSandbox,
    todayStr,
    nowMinutes,
    userTimezone,
    secondaryTimezone,
    onToggleSelect,
    onOpenPopover,
    onApplyPresetToShift,
    onOpenCoverFinder,
  }) => {
    const isOff = isTimeOffShift(
      shift.type,
      shift.localStartTime,
      shift.localEndTime
    );
    const badgeStyle = getShiftBadgeStyle(shift.type);
    const durationHrs = computeShiftDurationHours(
      shift.localStartTime,
      shift.localEndTime,
      shift.type
    );
    const segments = computeMiniBarSegments(
      shift.localStartTime,
      shift.localEndTime,
      shift.type
    );
    const liveProgress = computeActiveShiftProgress(
      shift.localDate,
      shift.localStartTime,
      shift.localEndTime,
      shift.type,
      todayStr,
      nowMinutes
    );

    const secondaryWindow =
      secondaryTimezone !== 'none' && !isOff
        ? formatSecondaryTimezoneWindow(
            shift.localDate,
            shift.localStartTime,
            shift.localEndTime,
            userTimezone,
            secondaryTimezone
          )
        : '';

    return (
      <>
        {/* Column 1: Checkbox */}
        <td
          className="px-4 py-3 align-middle w-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(shift.id);
          }}
        >
          <button
            type="button"
            className="p-0.5 rounded text-main-text-muted hover:text-primary cursor-pointer"
            aria-label={`Select shift for ${shift.userName}`}
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
        </td>

        {/* Column 2: Clean Operator Identity (Avatar + Name Only) */}
        <td className="px-4 py-3 align-middle">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-surface-3 border border-main-border flex items-center justify-center font-display font-semibold text-xs text-main-text shrink-0">
              {getInitials(shift.userName)}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-main-text truncate">
                {shift.userName}
              </span>
              {isCurrentUser && (
                <span className="text-[11px] text-primary font-medium shrink-0">
                  · You
                </span>
              )}
              {isStagedInSandbox && (
                <span className="text-[11px] text-warning font-mono shrink-0">
                  · Staged
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Column 3: Clean Local Date */}
        <td className="px-4 py-3 align-middle font-mono text-xs text-main-text-muted whitespace-nowrap tabular-nums">
          <span>{shift.localDate}</span>
          {shift.localDate === todayStr && (
            <span className="ml-2 text-[11px] font-sans font-medium text-primary">
              · Today
            </span>
          )}
        </td>

        {/* Column 4: Single Shift Type Badge with 1-Click Inline Morphing */}
        <td
          className="px-4 py-3 align-middle whitespace-nowrap relative"
          onClick={(e) => {
            if (isAdmin) {
              e.stopPropagation();
              onOpenPopover(isPopoverOpen ? null : shift.id);
            }
          }}
        >
          <span
            title={
              isAdmin
                ? 'Click to change shift type (or press 1, 2, 3, G, W, C)'
                : undefined
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${badgeStyle.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dotClass}`} />
            <span>{shift.type}</span>
          </span>

          {isAdmin && isPopoverOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-4 top-11 z-30 w-44 p-1 rounded-lg bg-surface-2 border border-main-border shadow-lg space-y-0.5"
            >
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-main-text-muted border-b border-main-border flex items-center justify-between">
                <span>Change Shift</span>
                <button
                  type="button"
                  onClick={() => onOpenPopover(null)}
                  className="text-main-text-muted hover:text-main-text cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {SHIFT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyPresetToShift(shift, preset.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    shift.type.toLowerCase() === preset.id.toLowerCase()
                      ? 'bg-primary-subtle text-primary font-semibold'
                      : 'text-main-text hover:bg-surface-3'
                  }`}
                >
                  <span>{preset.id}</span>
                  <span className="text-[10px] font-mono text-main-text-muted">
                    {preset.isRestDay
                      ? 'Rest'
                      : `${preset.defaultStart}–${preset.defaultEnd}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </td>

        {/* Column 5: Shift Hours & Slim Progress Bar */}
        <td className="px-4 py-3 align-middle min-w-[210px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                {isOff ? (
                  <span className="text-main-text-muted">Rest Day</span>
                ) : (
                  <span className="text-main-text">
                    {shift.localStartTime} – {shift.localEndTime}
                    {liveProgress.isLiveNow && (
                      <span className="ml-2 text-success font-sans text-[11px] font-medium">
                        · Live
                      </span>
                    )}
                  </span>
                )}
                <span className="text-main-text-muted">
                  {isOff ? '0h' : `${durationHrs}h`}
                </span>
              </div>

              {secondaryWindow && (
                <div className="text-[10px] font-mono text-main-text-muted tabular-nums">
                  {secondaryTimezone.split('/').pop()?.replace('_', ' ')}:{' '}
                  {secondaryWindow}
                </div>
              )}

              <div className="h-1.5 w-full rounded-full bg-surface-1 overflow-hidden relative">
                {segments.map((seg, idx) => (
                  <div
                    key={idx}
                    style={{
                      left: `${seg.leftPct}%`,
                      width: `${seg.widthPct}%`,
                    }}
                    className={`absolute top-0 bottom-0 rounded-full ${badgeStyle.barClass}`}
                  />
                ))}
              </div>
            </div>

            {isAdmin && !isOff && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCoverFinder(isFinderOpen ? null : shift.id);
                }}
                title="Find replacement operator"
                className={`p-1.5 rounded-md border text-xs transition-opacity cursor-pointer shrink-0 ${
                  isFinderOpen
                    ? 'bg-primary text-text-on-primary border-primary opacity-100'
                    : 'bg-surface-1 hover:bg-surface-3 text-main-text-muted hover:text-main-text border-main-border opacity-0 group-hover:opacity-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </>
    );
  }
);

RosterTableRowCells.displayName = 'RosterTableRowCells';

// Memoized Virtualized Week Grid Shift Card (Name, Shift Badge, Hours Only)
interface WeekGridShiftCardProps {
  shift: LocalizedShiftRecord;
  onInspectShift?: (shift: Shift) => void;
}

const WeekGridShiftCard = React.memo<WeekGridShiftCardProps>(
  ({ shift, onInspectShift }) => {
    const badge = getShiftBadgeStyle(shift.type);
    const isOff = isTimeOffShift(
      shift.type,
      shift.localStartTime,
      shift.localEndTime
    );

    return (
      <div className="pb-1.5">
        <div
          onClick={() => onInspectShift?.(shift)}
          className="p-2 rounded-lg bg-surface-1 border border-main-border hover:border-main-border-strong transition-colors cursor-pointer content-auto-card gpu-layer"
        >
          <p className="text-xs font-medium text-main-text truncate">
            {shift.userName}
          </p>
          <div className="mt-1 flex items-center justify-between gap-1">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.badgeClass}`}
            >
              {shift.type}
            </span>
            <span className="text-[10px] font-mono text-main-text-muted tabular-nums">
              {isOff ? 'Rest' : `${shift.localStartTime}–${shift.localEndTime}`}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

WeekGridShiftCard.displayName = 'WeekGridShiftCard';

export default function Dashboard({
  mode,
  subTab,
  onNavigate,
  onNavigateModuleSubTab,
  onSelectSubTab,
  onInspectShift,
  externalWeekStart,
  onChangeExternalWeekStart,
  externalTypeFilter,
  onChangeExternalTypeFilter,
  externalSearchQuery,
  onChangeExternalSearchQuery,
}: DashboardProps) {
  const { user, profile } = useAuth();
  const { userTimezone, convertToUserTime, convertToAppTime } = useTimezone();
  const { setShiftPhaseAura } = useTheme();
  const { showToast } = useToast();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [openIncidents, setOpenIncidents] = useState<IncidentTicket[]>([]);

  const [internalWeekStart, setInternalWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | ShiftCategory
  >('all');
  const [rosterDateScope, setRosterDateScope] =
    useState<RosterDateScope>('all');
  const [sortField, setSortField] = useState<RosterSortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Collapsible Tools & Export Popover State
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  // 120fps TableVirtuoso Handle + Spatial Keyboard Cursor
  const tableVirtuosoRef = useRef<TableVirtuosoHandle | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  // Secondary Timezone Lens
  const [secondaryTimezone, setSecondaryTimezone] = useState<string>('none');

  // What-If Sandbox Simulation Mode
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [stagedEdits, setStagedEdits] = useState<
    Record<string, StagedShiftEdit>
  >({});
  const [stagedCreations, setStagedCreations] = useState<
    Array<{
      tempId: string;
      userId: string;
      userName: string;
      localDate: string;
      startTime: string;
      endTime: string;
      type: string;
    }>
  >([]);
  const [isCommittingSandbox, setIsCommittingSandbox] = useState(false);

  // Inline Popover & Smart Replacement Cover Finder
  const [activePopoverShiftId, setActivePopoverShiftId] = useState<
    string | null
  >(null);
  const [coverFinderShiftId, setCoverFinderShiftId] = useState<string | null>(
    null
  );

  // Live minute ticker
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        toolsMenuRef.current &&
        !toolsMenuRef.current.contains(e.target as Node)
      ) {
        setToolsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Multi-select bulk operations state
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(
    new Set()
  );
  const [bulkShiftPreset, setBulkShiftPreset] = useState<string>('1st Shift');
  const [bulkReassignUserId, setBulkReassignUserId] = useState<string>('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const currentWeekStart = externalWeekStart ?? internalWeekStart;
  const setCurrentWeekStart = useCallback(
    (next: Date | ((prev: Date) => Date)) => {
      const resolved =
        typeof next === 'function' ? next(currentWeekStart) : next;
      if (onChangeExternalWeekStart) {
        onChangeExternalWeekStart(resolved);
      } else {
        setInternalWeekStart(resolved);
      }
    },
    [currentWeekStart, onChangeExternalWeekStart]
  );

  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const setSearchQuery = useCallback(
    (q: string) => {
      if (onChangeExternalSearchQuery) {
        onChangeExternalSearchQuery(q);
      } else {
        setInternalSearchQuery(q);
      }
    },
    [onChangeExternalSearchQuery]
  );

  useEffect(() => {
    if (isSandboxMode) {
      setShiftPhaseAura('sandbox');
      return;
    }
    if (selectedCategory === 'first') {
      setShiftPhaseAura('first');
      return;
    }
    if (selectedCategory === 'second') {
      setShiftPhaseAura('second');
      return;
    }
    if (selectedCategory === 'third') {
      setShiftPhaseAura('third');
      return;
    }
    const currentHour = nowMinutes / 60;
    if (currentHour >= 7.5 && currentHour < 12.5) setShiftPhaseAura('first');
    else if (currentHour >= 12.5 && currentHour < 20.5) setShiftPhaseAura('second');
    else setShiftPhaseAura('third');
  }, [isSandboxMode, selectedCategory, nowMinutes, setShiftPhaseAura]);

  useEffect(() => {
    if (!externalTypeFilter) return;
    if (externalTypeFilter === 'all') {
      setSelectedCategory('all');
    } else {
      setSelectedCategory(categorizeShiftType(externalTypeFilter));
    }
  }, [externalTypeFilter]);

  const handleSelectCategory = (cat: 'all' | ShiftCategory) => {
    startTransition(() => {
      setSelectedCategory(cat);
      if (onChangeExternalTypeFilter) {
        if (cat === 'all') onChangeExternalTypeFilter('all');
        else if (cat === 'first') onChangeExternalTypeFilter('1st Shift');
        else if (cat === 'second') onChangeExternalTypeFilter('2nd Shift');
        else if (cat === 'third') onChangeExternalTypeFilter('3rd Shift');
        else if (cat === 'general') onChangeExternalTypeFilter('General');
        else if (cat === 'off') onChangeExternalTypeFilter('WO');
      }
    });
  };

  useEffect(() => {
    if (!user) return;

    const unsubShifts = onSnapshot(
      collection(db, 'shifts'),
      (snap) => {
        setShifts(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift))
        );
      },
      (err) => console.error('Shifts listener error:', err)
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(
          snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
        );
      },
      (err) => console.error('Users listener error:', err)
    );

    const unsubAnnouncements = onSnapshot(
      collection(db, 'announcements'),
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Announcement)
        );
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setAnnouncements(list.slice(0, 3));
      },
      (err) => console.error('Announcements listener error:', err)
    );

    const unsubIncidents = onSnapshot(
      collection(db, 'incidentTickets'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as IncidentTicket))
          .filter((inc) => inc.status !== 'resolved');
        setOpenIncidents(list);
      },
      (err) => console.error('Incidents listener error:', err)
    );

    let unsubLeaves = () => {};
    if (profile?.role === 'admin') {
      const qLeaves = query(collection(db, 'leaveRequests'));
      unsubLeaves = onSnapshot(
        qLeaves,
        (snap) => {
          const allLeaves = snap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as LeaveRequest)
          );
          setPendingLeaves(allLeaves.filter((l) => l.status === 'pending'));
        },
        (err) => console.error('Leaves listener error:', err)
      );
    }

    return () => {
      unsubShifts();
      unsubUsers();
      unsubAnnouncements();
      unsubIncidents();
      unsubLeaves();
    };
  }, [user, profile?.role]);

  const userMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    for (const u of users) {
      map[u.uid] = u;
    }
    return map;
  }, [users]);

  const localizedShifts: LocalizedShiftRecord[] = useMemo(() => {
    const baseList = shifts.map((s) => {
      const staged = isSandboxMode ? stagedEdits[s.id] : undefined;
      const effectiveType = staged ? staged.type : s.type;
      const effectiveStart = staged ? staged.startTime : s.startTime;
      const effectiveEnd = staged ? staged.endTime : s.endTime;

      const startConv = convertToUserTime(s.date, effectiveStart);
      const endConv = convertToUserTime(s.date, effectiveEnd);
      return {
        ...s,
        type: effectiveType,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        localDate: startConv.date || s.date,
        localStartTime: startConv.time || effectiveStart,
        localEndTime: endConv.time || effectiveEnd,
      };
    });

    if (isSandboxMode && stagedCreations.length > 0) {
      const createdRecords: LocalizedShiftRecord[] = stagedCreations.map(
        (c) => ({
          id: c.tempId,
          userId: c.userId,
          userName: c.userName,
          date: c.localDate,
          startTime: c.startTime,
          endTime: c.endTime,
          type: c.type,
          localDate: c.localDate,
          localStartTime: c.startTime,
          localEndTime: c.endTime,
        })
      );
      return [...baseList, ...createdRecords];
    }

    return baseList;
  }, [
    shifts,
    convertToUserTime,
    isSandboxMode,
    stagedEdits,
    stagedCreations,
  ]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  );
  const weekStartStr = format(weekDays[0], 'yyyy-MM-dd');
  const weekEndStr = format(weekDays[6], 'yyyy-MM-dd');

  const fullShiftIndexMap = useMemo(
    () => buildShiftIndexMap(localizedShifts),
    [localizedShifts]
  );

  const workloadMap = useMemo(
    () => computeOperatorWorkloadMap(localizedShifts, weekDays),
    [localizedShifts, weekDays]
  );

  const scopedBaseShifts = useMemo(() => {
    return localizedShifts.filter((s) => {
      if (subTab === 'mine' && s.userId !== user?.uid) return false;
      if (subTab === 'list' || mode === 'overview') {
        if (rosterDateScope === 'week') {
          return s.localDate >= weekStartStr && s.localDate <= weekEndStr;
        }
        if (rosterDateScope === 'today') {
          return s.localDate === todayStr;
        }
        if (rosterDateScope === 'upcoming') {
          return s.localDate >= todayStr;
        }
        return true;
      }
      return s.localDate >= weekStartStr && s.localDate <= weekEndStr;
    });
  }, [
    localizedShifts,
    subTab,
    mode,
    user?.uid,
    rosterDateScope,
    weekStartStr,
    weekEndStr,
    todayStr,
  ]);

  const categoryDistribution = useMemo(() => {
    const counts: Record<ShiftCategory | 'wo' | 'co', number> = {
      first: 0,
      second: 0,
      third: 0,
      general: 0,
      off: 0,
      custom: 0,
      wo: 0,
      co: 0,
    };

    for (const s of scopedBaseShifts) {
      const cat = categorizeShiftType(s.type);
      counts[cat] = (counts[cat] || 0) + 1;
      const norm = s.type.trim().toLowerCase();
      if (norm === 'co' || norm === 'comp off') {
        counts.co += 1;
      } else if (cat === 'off') {
        counts.wo += 1;
      }
    }
    return counts;
  }, [scopedBaseShifts]);

  const filteredShifts = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();

    const matches = scopedBaseShifts.filter((s) => {
      if (selectedCategory !== 'all') {
        const cat = categorizeShiftType(s.type);
        if (cat !== selectedCategory) return false;
      }
      if (q) {
        const u = userMap[s.userId];
        const empId = u?.employeeId?.toLowerCase() || '';
        const roleStr = u?.role?.toLowerCase() || '';
        const hay = `${s.userName} ${s.type} ${s.localDate} ${empId} ${roleStr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...matches].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = `${a.localDate}T${a.localStartTime}`.localeCompare(
          `${b.localDate}T${b.localStartTime}`
        );
      } else if (sortField === 'operator') {
        cmp = (a.userName || '').localeCompare(b.userName || '');
      } else if (sortField === 'shiftType') {
        cmp = (a.type || '').localeCompare(b.type || '');
      } else if (sortField === 'duration') {
        const dA = computeShiftDurationHours(
          a.localStartTime,
          a.localEndTime,
          a.type
        );
        const dB = computeShiftDurationHours(
          b.localStartTime,
          b.localEndTime,
          b.type
        );
        cmp = dA - dB;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    scopedBaseShifts,
    selectedCategory,
    deferredSearchQuery,
    userMap,
    sortField,
    sortDir,
  ]);

  useEffect(() => {
    setFocusedRowIndex(-1);
  }, [selectedCategory, deferredSearchQuery, rosterDateScope, sortField, sortDir]);

  // O(1) Pre-Grouped Day Shifts Map for 120fps Week Grid Columns
  const weekDayShiftsMap = useMemo(() => {
    const map: Record<string, LocalizedShiftRecord[]> = {};
    for (const day of weekDays) {
      map[format(day, 'yyyy-MM-dd')] = [];
    }
    for (const s of filteredShifts) {
      if (map[s.localDate]) {
        map[s.localDate].push(s);
      }
    }
    return map;
  }, [weekDays, filteredShifts]);

  const myUpcomingShifts = useMemo(() => {
    if (!user) return [];
    return localizedShifts
      .filter(
        (s) =>
          s.userId === user.uid &&
          s.localDate >= todayStr &&
          !isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
      )
      .sort((a, b) =>
        `${a.localDate}T${a.localStartTime}`.localeCompare(
          `${b.localDate}T${b.localStartTime}`
        )
      );
  }, [localizedShifts, user, todayStr]);

  const nextShift = myUpcomingShifts[0] || null;

  const todayShifts = useMemo(() => {
    return (fullShiftIndexMap.byDate.get(todayStr) || []).sort((a, b) =>
      a.localStartTime.localeCompare(b.localStartTime)
    );
  }, [fullShiftIndexMap, todayStr]);

  const todayActiveCount = useMemo(
    () =>
      todayShifts.filter(
        (s) => !isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
      ).length,
    [todayShifts]
  );

  const teamHealthMetrics = useMemo(() => {
    const vals = Object.values(workloadMap) as OperatorWorkloadStats[];
    if (vals.length === 0) {
      return { avgEquity: 96, clopenCount: 0, overloadedCount: 0 };
    }
    const sumEq = vals.reduce((acc, v) => acc + v.equityScore, 0);
    const clopenCount = vals.filter((v) => v.hasClopenRisk).length;
    const overloadedCount = vals.filter(
      (v) => v.loadLevel === 'overloaded'
    ).length;
    return {
      avgEquity: Math.round(sumEq / vals.length),
      clopenCount,
      overloadedCount,
    };
  }, [workloadMap]);

  const isAdmin = profile?.role === 'admin';
  const dailyTarget = Math.max(3, Math.ceil(users.length * 0.6));
  const slaMinPerWindow = Math.max(1, Math.floor(dailyTarget / 3));

  const stagedChangesCount =
    Object.keys(stagedEdits).length + stagedCreations.length;

  const toggleShiftSelection = useCallback((id: string) => {
    setSelectedShiftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllFiltered = () => {
    if (filteredShifts.length === 0) return;
    const allSelected = filteredShifts.every((s) =>
      selectedShiftIds.has(s.id)
    );
    if (allSelected) {
      setSelectedShiftIds(new Set());
    } else {
      setSelectedShiftIds(new Set(filteredShifts.map((s) => s.id)));
    }
  };

  const handleApplyPresetToShift = useCallback(
    async (shift: LocalizedShiftRecord, presetId: string) => {
      const preset = getPresetForShiftType(presetId);
      setActivePopoverShiftId(null);

      if (isSandboxMode) {
        if (shift.id.startsWith('staged-')) {
          setStagedCreations((prev) =>
            prev.map((c) =>
              c.tempId === shift.id
                ? {
                    ...c,
                    type: preset.id,
                    startTime: preset.defaultStart,
                    endTime: preset.defaultEnd,
                  }
                : c
            )
          );
        } else {
          setStagedEdits((prev) => ({
            ...prev,
            [shift.id]: {
              type: preset.id,
              startTime: preset.defaultStart,
              endTime: preset.defaultEnd,
            },
          }));
        }
        showToast({
          type: 'info',
          title: `Staged ${shift.userName} → ${preset.id}`,
          description: 'Change held in What-If Sandbox buffer.',
          liveBadge: 'SANDBOX',
        });
        return;
      }

      const prevState = {
        type: shift.type,
        startTime: shift.startTime,
        endTime: shift.endTime,
      };
      const startApp = convertToAppTime(shift.localDate, preset.defaultStart);
      const endApp = convertToAppTime(shift.localDate, preset.defaultEnd);

      try {
        await updateDoc(doc(db, 'shifts', shift.id), {
          type: preset.id,
          startTime: startApp.time,
          endTime: endApp.time,
          updatedAt: Date.now(),
        });

        showToast({
          type: 'success',
          title: `Updated ${shift.userName} to ${preset.id}`,
          description: `${shift.localDate} · ${
            preset.isRestDay
              ? 'Rest Day'
              : `${preset.defaultStart}–${preset.defaultEnd}`
          }`,
          liveBadge: 'LIVE SYNC',
          onUndo: async () => {
            await updateDoc(doc(db, 'shifts', shift.id), {
              ...prevState,
              updatedAt: Date.now(),
            });
          },
        });
      } catch (err) {
        console.error('Inline shift update failed:', err);
      }
    },
    [isSandboxMode, convertToAppTime, showToast]
  );

  const handleCycleMatrixCellShift = useCallback(
    async (
      targetUser: UserProfile,
      dateStr: string,
      existingShift?: LocalizedShiftRecord
    ) => {
      if (!isAdmin) return;

      const nextPreset = getNextCycledShiftPreset(existingShift?.type);
      const userName =
        targetUser.displayName || targetUser.email || 'Team Member';

      if (existingShift) {
        await handleApplyPresetToShift(existingShift, nextPreset.id);
        return;
      }

      if (isSandboxMode) {
        setStagedCreations((prev) => [
          ...prev,
          {
            tempId: `staged-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 6)}`,
            userId: targetUser.uid,
            userName,
            localDate: dateStr,
            startTime: nextPreset.defaultStart,
            endTime: nextPreset.defaultEnd,
            type: nextPreset.id,
          },
        ]);
        showToast({
          type: 'info',
          title: `Staged ${userName} → ${nextPreset.id}`,
          description: `${dateStr} added in What-If Sandbox.`,
          liveBadge: 'SANDBOX',
        });
        return;
      }

      try {
        const startApp = convertToAppTime(dateStr, nextPreset.defaultStart);
        const endApp = convertToAppTime(dateStr, nextPreset.defaultEnd);
        const createdRef = await addDoc(collection(db, 'shifts'), {
          userId: targetUser.uid,
          userName,
          date: startApp.date,
          startTime: startApp.time,
          endTime: endApp.time,
          type: nextPreset.id,
          updatedAt: Date.now(),
        });

        showToast({
          type: 'success',
          title: `Assigned ${nextPreset.id} to ${userName}`,
          description: `${dateStr} (${nextPreset.defaultStart}–${nextPreset.defaultEnd})`,
          liveBadge: 'MATRIX SYNC',
          onUndo: async () => {
            await deleteDoc(doc(db, 'shifts', createdRef.id));
          },
        });
      } catch (err) {
        console.error('Matrix cell creation failed:', err);
      }
    },
    [isAdmin, isSandboxMode, handleApplyPresetToShift, convertToAppTime, showToast]
  );

  const handleRunAutopilotWeek = useCallback(async () => {
    if (!isAdmin) return;
    setToolsMenuOpen(false);
    const result = solveAutonomousWeekSchedule(
      weekDays,
      localizedShifts,
      users,
      slaMinPerWindow
    );

    if (result.newShifts.length === 0) {
      showToast({
        type: 'info',
        title: 'Week SLA Already Balanced',
        description:
          'All 1st, 2nd, and 3rd shift windows meet minimum SLA staffing with zero clopen conflicts.',
        liveBadge: 'OPTIMAL',
      });
      return;
    }

    if (isSandboxMode) {
      const stagedItems = result.newShifts.map((ns, idx) => ({
        tempId: `staged-auto-${Date.now()}-${idx}`,
        ...ns,
      }));
      setStagedCreations((prev) => [...prev, ...stagedItems]);
      showToast({
        type: 'info',
        title: `Autopilot Staged ${result.newShifts.length} Shifts`,
        description: `Filled ${result.windowsFilled} SLA windows + ${result.restDaysAssigned} WO rest days in Sandbox.`,
        liveBadge: 'AUTOPILOT SANDBOX',
      });
      return;
    }

    setIsBulkSaving(true);
    try {
      const batch = writeBatch(db);
      const createdRefs: string[] = [];

      for (const ns of result.newShifts) {
        const startApp = convertToAppTime(ns.localDate, ns.startTime);
        const endApp = convertToAppTime(ns.localDate, ns.endTime);
        const newRef = doc(collection(db, 'shifts'));
        createdRefs.push(newRef.id);
        batch.set(newRef, {
          userId: ns.userId,
          userName: ns.userName,
          date: startApp.date,
          startTime: startApp.time,
          endTime: endApp.time,
          type: ns.type,
          updatedAt: Date.now(),
        });
      }

      await batch.commit();
      showToast({
        type: 'success',
        title: `Autopilot Balanced ${result.newShifts.length} Shifts`,
        description: `${result.windowsFilled} SLA windows filled · ${result.restDaysAssigned} WO rest days assigned.`,
        liveBadge: 'AUTOPILOT LIVE',
        onUndo: async () => {
          const undoBatch = writeBatch(db);
          createdRefs.forEach((id) =>
            undoBatch.delete(doc(db, 'shifts', id))
          );
          await undoBatch.commit();
        },
      });
    } catch (err) {
      console.error('Autopilot week solver failed:', err);
    } finally {
      setIsBulkSaving(false);
    }
  }, [
    isAdmin,
    weekDays,
    localizedShifts,
    users,
    slaMinPerWindow,
    isSandboxMode,
    convertToAppTime,
    showToast,
  ]);

  const handleSimulateCallOutStressTest = useCallback(() => {
    setToolsMenuOpen(false);
    const activeWeekShifts = localizedShifts.filter(
      (s) =>
        s.localDate >= weekStartStr &&
        s.localDate <= weekEndStr &&
        !isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
    );
    const targetShift = activeWeekShifts[0] || localizedShifts[0];
    if (!targetShift) return;

    if (!isSandboxMode) {
      setIsSandboxMode(true);
    }
    setCoverFinderShiftId(targetShift.id);
    showToast({
      type: 'warning',
      title: `Call-Out Stress Probe: ${targetShift.userName}`,
      description: `Simulating unexpected call-out on ${targetShift.localDate} (${targetShift.type}). Select a replacement operator.`,
      liveBadge: 'STRESS PROBE',
    });
  }, [localizedShifts, weekStartStr, weekEndStr, isSandboxMode, showToast]);

  // Spatial Keyboard Navigation (J / K row glide, Space inspect, 1/2/3/G/W/C inline morph, F Find Cover)
  useEffect(() => {
    if (subTab !== 'list' && !(mode === 'overview' && subTab === 'roster')) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setFocusedRowIndex((prev) => {
          const next = Math.min(filteredShifts.length - 1, prev + 1);
          if (next >= 0) {
            tableVirtuosoRef.current?.scrollToIndex({
              index: next,
              align: 'center',
              behavior: 'smooth',
            });
          }
          return next;
        });
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setFocusedRowIndex((prev) => {
          const next = Math.max(0, prev - 1);
          if (next >= 0) {
            tableVirtuosoRef.current?.scrollToIndex({
              index: next,
              align: 'center',
              behavior: 'smooth',
            });
          }
          return next;
        });
      } else if (
        e.key === ' ' &&
        focusedRowIndex >= 0 &&
        focusedRowIndex < filteredShifts.length
      ) {
        e.preventDefault();
        const focusedShift = filteredShifts[focusedRowIndex];
        if (focusedShift && onInspectShift) {
          onInspectShift(focusedShift);
        }
      } else if (
        (e.key === 'f' || e.key === 'F') &&
        isAdmin &&
        focusedRowIndex >= 0 &&
        focusedRowIndex < filteredShifts.length
      ) {
        e.preventDefault();
        const focusedShift = filteredShifts[focusedRowIndex];
        if (focusedShift) {
          setCoverFinderShiftId((prev) =>
            prev === focusedShift.id ? null : focusedShift.id
          );
        }
      } else if (
        isAdmin &&
        focusedRowIndex >= 0 &&
        focusedRowIndex < filteredShifts.length
      ) {
        const focusedShift = filteredShifts[focusedRowIndex];
        if (!focusedShift) return;
        const keyMap: Record<string, string> = {
          '1': '1st Shift',
          '2': '2nd Shift',
          '3': '3rd Shift',
          g: 'General',
          G: 'General',
          w: 'WO',
          W: 'WO',
          c: 'CO',
          C: 'CO',
        };
        if (keyMap[e.key]) {
          e.preventDefault();
          handleApplyPresetToShift(focusedShift, keyMap[e.key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    subTab,
    mode,
    filteredShifts,
    focusedRowIndex,
    isAdmin,
    onInspectShift,
    handleApplyPresetToShift,
  ]);

  const handleAssignCoverCandidate = async (
    shift: LocalizedShiftRecord,
    candidate: UserProfile
  ) => {
    setCoverFinderShiftId(null);
    const prevUser = { userId: shift.userId, userName: shift.userName };
    const newName =
      candidate.displayName || candidate.email || 'Team Member';

    try {
      await updateDoc(doc(db, 'shifts', shift.id), {
        userId: candidate.uid,
        userName: newName,
        updatedAt: Date.now(),
      });

      showToast({
        type: 'success',
        title: `Assigned ${newName} to cover ${shift.type}`,
        description: `${shift.localDate} (${shift.localStartTime}–${shift.localEndTime})`,
        liveBadge: 'COVER ASSIGNED',
        onUndo: async () => {
          await updateDoc(doc(db, 'shifts', shift.id), {
            userId: prevUser.userId,
            userName: prevUser.userName,
            updatedAt: Date.now(),
          });
        },
      });
    } catch (err) {
      console.error('Cover assignment failed:', err);
    }
  };

  const handleCommitSandbox = async () => {
    if (stagedChangesCount === 0) {
      setIsSandboxMode(false);
      return;
    }
    setIsCommittingSandbox(true);
    try {
      const batch = writeBatch(db);

      for (const [shiftId, edit] of Object.entries(stagedEdits) as Array<
        [string, StagedShiftEdit]
      >) {
        const orig = localizedShifts.find((s) => s.id === shiftId);
        const dateRef = orig?.localDate || todayStr;
        const startApp = convertToAppTime(dateRef, edit.startTime);
        const endApp = convertToAppTime(dateRef, edit.endTime);

        batch.update(doc(db, 'shifts', shiftId), {
          type: edit.type,
          startTime: startApp.time,
          endTime: endApp.time,
          updatedAt: Date.now(),
        });
      }

      for (const created of stagedCreations) {
        const startApp = convertToAppTime(
          created.localDate,
          created.startTime
        );
        const endApp = convertToAppTime(created.localDate, created.endTime);
        const newRef = doc(collection(db, 'shifts'));
        batch.set(newRef, {
          userId: created.userId,
          userName: created.userName,
          date: startApp.date,
          startTime: startApp.time,
          endTime: endApp.time,
          type: created.type,
          updatedAt: Date.now(),
        });
      }

      await batch.commit();
      const count = stagedChangesCount;
      setStagedEdits({});
      setStagedCreations([]);
      setIsSandboxMode(false);

      showToast({
        type: 'success',
        title: `Published ${count} Sandbox Change${count > 1 ? 's' : ''}`,
        description: 'Live team roster updated across all connected clients.',
        liveBadge: 'COMMITTED',
      });
    } catch (err) {
      console.error('Sandbox commit failed:', err);
    } finally {
      setIsCommittingSandbox(false);
    }
  };

  const handleDiscardSandbox = () => {
    setStagedEdits({});
    setStagedCreations([]);
    setIsSandboxMode(false);
    showToast({
      type: 'info',
      title: 'Sandbox Simulation Discarded',
      description: 'Restored live production roster state.',
    });
  };

  const handleBulkUpdateShiftType = async () => {
    if (!isAdmin || selectedShiftIds.size === 0) return;
    const preset = getPresetForShiftType(bulkShiftPreset);

    if (isSandboxMode) {
      const nextEdits = { ...stagedEdits };
      selectedShiftIds.forEach((id) => {
        nextEdits[id] = {
          type: preset.id,
          startTime: preset.defaultStart,
          endTime: preset.defaultEnd,
        };
      });
      setStagedEdits(nextEdits);
      setSelectedShiftIds(new Set());
      showToast({
        type: 'info',
        title: `Staged ${selectedShiftIds.size} shifts → ${preset.id}`,
        description: 'Review in What-If Sandbox before publishing.',
        liveBadge: 'SANDBOX',
      });
      return;
    }

    setIsBulkSaving(true);
    try {
      const batch = writeBatch(db);
      selectedShiftIds.forEach((shiftId) => {
        const existing = localizedShifts.find((s) => s.id === shiftId);
        if (!existing) return;
        const startApp = convertToAppTime(
          existing.localDate,
          preset.defaultStart
        );
        const endApp = convertToAppTime(existing.localDate, preset.defaultEnd);
        batch.update(doc(db, 'shifts', shiftId), {
          type: preset.id,
          startTime: startApp.time,
          endTime: endApp.time,
          updatedAt: Date.now(),
        });
      });
      await batch.commit();
      const count = selectedShiftIds.size;
      setSelectedShiftIds(new Set());
      showToast({
        type: 'success',
        title: `Bulk updated ${count} shifts to ${preset.id}`,
        liveBadge: 'BULK SYNC',
      });
    } catch (err) {
      console.error('Bulk shift type update failed:', err);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleBulkRotateShifts = async () => {
    if (!isAdmin || selectedShiftIds.size === 0) return;

    if (isSandboxMode) {
      const nextEdits = { ...stagedEdits };
      selectedShiftIds.forEach((shiftId) => {
        const existing = localizedShifts.find((s) => s.id === shiftId);
        if (!existing) return;
        const rotated = getRotatedShiftType(existing.type);
        nextEdits[shiftId] = rotated;
      });
      setStagedEdits(nextEdits);
      setSelectedShiftIds(new Set());
      showToast({
        type: 'info',
        title: `Rotated ${selectedShiftIds.size} shifts in Sandbox`,
        description: '1st → 2nd → 3rd shift forward rotation staged.',
        liveBadge: 'SANDBOX',
      });
      return;
    }

    setIsBulkSaving(true);
    try {
      const batch = writeBatch(db);
      selectedShiftIds.forEach((shiftId) => {
        const existing = localizedShifts.find((s) => s.id === shiftId);
        if (!existing) return;
        const rotated = getRotatedShiftType(existing.type);
        const startApp = convertToAppTime(
          existing.localDate,
          rotated.startTime
        );
        const endApp = convertToAppTime(existing.localDate, rotated.endTime);
        batch.update(doc(db, 'shifts', shiftId), {
          type: rotated.type,
          startTime: startApp.time,
          endTime: endApp.time,
          updatedAt: Date.now(),
        });
      });
      await batch.commit();
      const count = selectedShiftIds.size;
      setSelectedShiftIds(new Set());
      showToast({
        type: 'success',
        title: `Rotated ${count} shifts forward (1st → 2nd → 3rd)`,
        liveBadge: 'ROTATED',
      });
    } catch (err) {
      console.error('Bulk shift rotation failed:', err);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleBulkReassignOperator = async () => {
    if (!isAdmin || !bulkReassignUserId || selectedShiftIds.size === 0) return;
    const targetUser = userMap[bulkReassignUserId];
    if (!targetUser) return;

    setIsBulkSaving(true);
    try {
      const batch = writeBatch(db);
      selectedShiftIds.forEach((shiftId) => {
        batch.update(doc(db, 'shifts', shiftId), {
          userId: targetUser.uid,
          userName:
            targetUser.displayName || targetUser.email || 'Team Member',
          updatedAt: Date.now(),
        });
      });
      await batch.commit();
      setSelectedShiftIds(new Set());
      setBulkReassignUserId('');
      showToast({
        type: 'success',
        title: `Reassigned shifts to ${targetUser.displayName}`,
        liveBadge: 'REASSIGNED',
      });
    } catch (err) {
      console.error('Bulk operator reassign failed:', err);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleBulkDeleteShifts = async () => {
    if (!isAdmin || selectedShiftIds.size === 0) return;
    setIsBulkSaving(true);
    try {
      const batch = writeBatch(db);
      selectedShiftIds.forEach((shiftId) => {
        batch.delete(doc(db, 'shifts', shiftId));
      });
      await batch.commit();
      const count = selectedShiftIds.size;
      setSelectedShiftIds(new Set());
      showToast({
        type: 'warning',
        title: `Deleted ${count} shift${count > 1 ? 's' : ''}`,
        liveBadge: 'DELETED',
      });
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setIsBulkSaving(false);
    }
  };

  // State and logic to synchronize existing shifts in Firestore to new standard timings
  const [isSyncingTimings, setIsSyncingTimings] = useState(false);
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);

  const handleSyncShiftsToNewTimings = useCallback(
    async (isAutomatic = false) => {
      if (!isAdmin || isSyncingTimings) return;
      setIsSyncingTimings(true);

      try {
        const shiftsToMigrate: Array<{
          id: string;
          startTime: string;
          endTime: string;
          type: string;
        }> = [];

        shifts.forEach((s) => {
          const typeLower = String(s.type || '').toLowerCase();
          const start = s.startTime;
          const end = s.endTime;

          let targetStart: string | null = null;
          let targetEnd: string | null = null;
          let targetType = s.type;

          // 1st Shift Day: 07:30–16:30
          if (
            typeLower.includes('1st') ||
            typeLower.includes('morning') ||
            start === '06:00'
          ) {
            if (start !== '07:30' || end !== '16:30') {
              targetStart = '07:30';
              targetEnd = '16:30';
              if (s.type === 'Morning') targetType = '1st Shift';
            }
          }
          // 2nd Shift Swing: 12:30–20:30
          else if (
            typeLower.includes('2nd') ||
            typeLower.includes('afternoon') ||
            typeLower.includes('swing') ||
            start === '14:00'
          ) {
            if (start !== '12:30' || end !== '20:30') {
              targetStart = '12:30';
              targetEnd = '20:30';
              if (s.type === 'Afternoon') targetType = '2nd Shift';
            }
          }
          // 3rd Shift Night: 20:30–07:30
          else if (
            typeLower.includes('3rd') ||
            typeLower.includes('night') ||
            start === '22:00'
          ) {
            if (start !== '20:30' || end !== '07:30') {
              targetStart = '20:30';
              targetEnd = '07:30';
              if (s.type === 'Night') targetType = '3rd Shift';
            }
          }
          // General: 09:00–18:00
          else if (typeLower.includes('general')) {
            if (start !== '09:00' || end !== '18:00') {
              targetStart = '09:00';
              targetEnd = '18:00';
            }
          }
          // WO: 00:00–00:00
          else if (s.type === 'WO' && (start !== '00:00' || end !== '00:00')) {
            targetStart = '00:00';
            targetEnd = '00:00';
          }
          // CO: 09:00–17:00
          else if (s.type === 'CO' && (start !== '09:00' || end !== '17:00')) {
            targetStart = '09:00';
            targetEnd = '17:00';
          }

          if (targetStart && targetEnd) {
            shiftsToMigrate.push({
              id: s.id,
              startTime: targetStart,
              endTime: targetEnd,
              type: targetType,
            });
          }
        });

        if (shiftsToMigrate.length === 0) {
          if (!isAutomatic) {
            showToast({
              type: 'info',
              title: 'All shifts are already synchronized',
              description:
                'All roster entries conform to official standard hours (07:30, 12:30, 20:30).',
              liveBadge: 'UP TO DATE',
            });
          }
          return;
        }

        // Commit in safe chunks of 400 for Firestore batch limits
        const chunkSize = 400;
        for (let i = 0; i < shiftsToMigrate.length; i += chunkSize) {
          const chunk = shiftsToMigrate.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          for (const item of chunk) {
            batch.update(doc(db, 'shifts', item.id), {
              startTime: item.startTime,
              endTime: item.endTime,
              type: item.type,
              updatedAt: Date.now(),
            });
          }
          await batch.commit();
        }

        showToast({
          type: 'success',
          title: `Synchronized ${shiftsToMigrate.length} shifts to new timings`,
          description:
            '1st (07:30–16:30), 2nd (12:30–20:30), 3rd (20:30–07:30) applied to database.',
          liveBadge: 'TIMINGS SYNCED',
        });
      } catch (err) {
        console.error('Error syncing shift timings:', err);
        showToast({
          type: 'error',
          title: 'Shift synchronization failed',
          description:
            err instanceof Error ? err.message : 'Unknown database error',
        });
      } finally {
        setIsSyncingTimings(false);
      }
    },
    [isAdmin, isSyncingTimings, shifts, showToast]
  );

  // Auto-synchronize legacy shifts when admin opens the dashboard
  useEffect(() => {
    if (isAdmin && !autoSyncAttempted && shifts.length > 0) {
      const hasLegacyShifts = shifts.some((s) => {
        const start = s.startTime;
        return start === '06:00' || start === '14:00' || start === '22:00';
      });
      if (hasLegacyShifts) {
        setAutoSyncAttempted(true);
        handleSyncShiftsToNewTimings(true);
      }
    }
  }, [isAdmin, autoSyncAttempted, shifts, handleSyncShiftsToNewTimings]);

  const toggleSort = (field: RosterSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ============================================================================
  // SINGLE UNIFIED COMMAND TOOLBAR (Replaces stacked banners + 6-card grid)
  // ============================================================================
  const renderSingleUnifiedCommandBar = (showScopeSelector: boolean) => {
    const filterPills: Array<{
      id: 'all' | ShiftCategory;
      label: string;
      count: number;
      dotClass?: string;
    }> = [
      { id: 'all', label: 'All', count: scopedBaseShifts.length },
      {
        id: 'first',
        label: '1st Shift',
        count: categoryDistribution.first,
        dotClass: 'bg-primary',
      },
      {
        id: 'second',
        label: '2nd Shift',
        count: categoryDistribution.second,
        dotClass: 'bg-secondary',
      },
      {
        id: 'third',
        label: '3rd Shift',
        count: categoryDistribution.third,
        dotClass: 'bg-info',
      },
      {
        id: 'general',
        label: 'General',
        count: categoryDistribution.general,
        dotClass: 'bg-warning',
      },
      {
        id: 'off',
        label: 'WO / CO',
        count: categoryDistribution.off,
        dotClass: 'bg-main-text-muted',
      },
    ];

    return (
      <div className="space-y-2.5">
        {/* Conditional Sandbox Active Strip (Appears ONLY when What-If Sandbox is active) */}
        {isSandboxMode && (
          <div className="px-4 py-2.5 rounded-lg bg-warning-subtle border border-warning/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <FlaskConical className="w-4 h-4 text-warning shrink-0" />
              <span className="font-semibold text-main-text">
                What-If Sandbox Active
              </span>
              <span className="text-main-text-muted font-mono tabular-nums">
                · {stagedChangesCount} staged change
                {stagedChangesCount === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={handleRunAutopilotWeek}
                    disabled={isBulkSaving}
                    className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Cpu className="w-3.5 h-3.5 text-primary" />
                    <span>Autopilot Week</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSimulateCallOutStressTest}
                    className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Flame className="w-3.5 h-3.5 text-error" />
                    <span>Simulate Call-Out</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleDiscardSandbox}
                className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>
              <button
                type="button"
                onClick={handleCommitSandbox}
                disabled={isCommittingSandbox}
                className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {isCommittingSandbox
                    ? 'Publishing...'
                    : `Publish (${stagedChangesCount})`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Single Unified Command Bar */}
        <div className="p-2.5 rounded-xl glass-card flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          {/* Left: Inline Segmented Shift Filter Pills with Live Counts */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {filterPills.map((pill) => {
              const isActive = selectedCategory === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() =>
                    handleSelectCategory(
                      isActive && pill.id !== 'all' ? 'all' : pill.id
                    )
                  }
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-surface-3 text-main-text font-semibold border border-main-border-strong'
                      : 'text-main-text-muted hover:text-main-text hover:bg-surface-3/50 border border-transparent'
                  }`}
                >
                  {pill.dotClass && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${pill.dotClass}`}
                    />
                  )}
                  <span>{pill.label}</span>
                  <span className="font-mono text-[11px] text-main-text-muted tabular-nums">
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Search + Week Pager + Collapsible Tools Menu */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-main-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search operator or shift..."
                className="pl-8 pr-7 py-1.5 rounded-lg bg-surface-1 border border-main-border text-xs text-main-text placeholder:text-main-text-muted focus:outline-none focus:border-primary w-full sm:w-48"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-main-text-muted hover:text-main-text text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Week Pager */}
            <div className="inline-flex items-center gap-0.5 bg-surface-1 border border-main-border rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setCurrentWeekStart((d) => addDays(d, -7))}
                className="p-1 rounded-md hover:bg-surface-3 text-main-text-muted hover:text-main-text transition-colors cursor-pointer"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentWeekStart(
                    startOfWeek(new Date(), { weekStartsOn: 1 })
                  )
                }
                title="Reset to current week"
                className="px-2 py-0.5 text-xs font-mono font-medium text-main-text hover:bg-surface-3 rounded-md whitespace-nowrap tabular-nums cursor-pointer"
              >
                {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d')}
              </button>
              <button
                type="button"
                onClick={() => setCurrentWeekStart((d) => addDays(d, 7))}
                className="p-1 rounded-md hover:bg-surface-3 text-main-text-muted hover:text-main-text transition-colors cursor-pointer"
                aria-label="Next week"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Collapsible Tools & Export Popover */}
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => setToolsMenuOpen((prev) => !prev)}
                className={`btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer ${
                  isSandboxMode || secondaryTimezone !== 'none'
                    ? 'border-primary/50 text-primary'
                    : ''
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Tools</span>
              </button>

              {toolsMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-surface-2 border border-main-border shadow-xl p-3 z-40 space-y-3 text-xs">
                  {isAdmin && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted block">
                        Automation & Simulation
                      </span>
                      <button
                        type="button"
                        onClick={handleRunAutopilotWeek}
                        disabled={isBulkSaving}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-primary-subtle hover:bg-primary/20 text-primary font-medium flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Cpu className="w-3.5 h-3.5 shrink-0" />
                        <span>1-Click Autopilot Balance Week</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMigrationModal(true);
                          setToolsMenuOpen(false);
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-secondary-subtle hover:bg-secondary/20 text-secondary font-medium flex items-center justify-between transition-colors cursor-pointer"
                        title="Audit and migrate all shifts in database to standard timings (1st: 07:30–16:30, 2nd: 12:30–20:30, 3rd: 20:30–07:30)"
                      >
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 shrink-0" />
                          <span>Firestore Timings Migration</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/20 text-secondary">
                          Audit
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSandboxMode((prev) => !prev);
                          setToolsMenuOpen(false);
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-surface-1 hover:bg-surface-3 text-main-text font-medium flex items-center justify-between border border-main-border transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <FlaskConical className="w-3.5 h-3.5 text-warning" />
                          <span>What-If Sandbox</span>
                        </span>
                        <span className="font-mono text-[10px] text-main-text-muted">
                          {isSandboxMode ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </div>
                  )}

                  {showScopeSelector && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted block">
                        Date Scope
                      </span>
                      <div className="grid grid-cols-2 gap-1">
                        {(
                          [
                            { id: 'all', label: 'All Dates' },
                            { id: 'week', label: 'Selected Week' },
                            { id: 'upcoming', label: 'Upcoming' },
                            { id: 'today', label: 'Today' },
                          ] as Array<{ id: RosterDateScope; label: string }>
                        ).map((sc) => (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => setRosterDateScope(sc.id)}
                            className={`py-1 px-2 rounded-md text-xs font-medium text-left cursor-pointer ${
                              rosterDateScope === sc.id
                                ? 'bg-primary text-text-on-primary'
                                : 'bg-surface-1 text-main-text-muted hover:text-main-text'
                            }`}
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-main-text-muted block">
                      2nd Timezone Lens
                    </span>
                    <div className="flex items-center gap-1.5 bg-surface-1 border border-main-border rounded-lg px-2 py-1">
                      <Globe className="w-3.5 h-3.5 text-main-text-muted shrink-0" />
                      <select
                        value={secondaryTimezone}
                        onChange={(e) => setSecondaryTimezone(e.target.value)}
                        aria-label="Secondary Timezone Lens"
                        className="bg-transparent text-xs text-main-text w-full focus:outline-none cursor-pointer"
                      >
                        <option value="none">Off ({userTimezone})</option>
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">New York (EST)</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Asia/Calcutta">India (IST)</option>
                        <option value="Asia/Singapore">Singapore (SGT)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-main-border flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        downloadShiftsCSV(filteredShifts, userTimezone);
                        setToolsMenuOpen(false);
                      }}
                      className="flex-1 btn-secondary py-1.5 px-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadShiftsICS(filteredShifts, userTimezone);
                        setToolsMenuOpen(false);
                      }}
                      className="flex-1 btn-secondary py-1.5 px-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Export .ICS</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // ULTRA-CLEAN 5-COLUMN ROSTER TABLE
  // ============================================================================
  const renderEnterpriseRosterTable = () => {
    const allFilteredSelected =
      filteredShifts.length > 0 &&
      filteredShifts.every((s) => selectedShiftIds.has(s.id));

    const coverTargetShift = coverFinderShiftId
      ? localizedShifts.find((s) => s.id === coverFinderShiftId) || null
      : null;
    const coverCandidates = useMemo(() => {
      if (!coverTargetShift) return [];
      return rankCoverCandidates(
        coverTargetShift,
        users,
        localizedShifts,
        workloadMap
      );
    }, [coverTargetShift, users, localizedShifts, workloadMap]);

    return (
      <div className="space-y-3">
        {/* Multi-Select Bulk Action Bar */}
        {selectedShiftIds.size > 0 && (
          <div className="px-4 py-2.5 rounded-lg bg-surface-2 border border-primary/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="font-mono font-bold text-primary tabular-nums">
                {selectedShiftIds.size} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedShiftIds(new Set())}
                className="text-main-text-muted hover:text-main-text underline cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <>
                  <div className="inline-flex items-center gap-1 bg-surface-1 border border-main-border rounded-md p-0.5">
                    <select
                      value={bulkShiftPreset}
                      onChange={(e) => setBulkShiftPreset(e.target.value)}
                      aria-label="Bulk shift type preset"
                      className="bg-transparent text-xs text-main-text px-2 py-0.5 focus:outline-none"
                    >
                      {SHIFT_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isBulkSaving}
                      onClick={handleBulkUpdateShiftType}
                      className="px-2.5 py-1 rounded bg-primary text-text-on-primary text-xs font-semibold cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isBulkSaving}
                    onClick={handleBulkRotateShifts}
                    className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                    title="Rotate 1st → 2nd → 3rd → 1st Shift"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-primary" />
                    <span>Rotate</span>
                  </button>

                  <div className="inline-flex items-center gap-1 bg-surface-1 border border-main-border rounded-md p-0.5">
                    <select
                      value={bulkReassignUserId}
                      onChange={(e) => setBulkReassignUserId(e.target.value)}
                      aria-label="Bulk reassign operator"
                      className="bg-transparent text-xs text-main-text px-2 py-0.5 focus:outline-none max-w-[140px]"
                    >
                      <option value="">Reassign...</option>
                      {users.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName || u.email}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isBulkSaving || !bulkReassignUserId}
                      onClick={handleBulkReassignOperator}
                      className="px-2 py-1 rounded bg-surface-3 text-main-text text-xs font-medium disabled:opacity-40 cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isBulkSaving}
                    onClick={handleBulkDeleteShifts}
                    className="py-1 px-2.5 rounded-md bg-error-subtle text-error text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Smart Cover Replacement Finder Banner */}
        {isAdmin && coverTargetShift && (
          <div className="p-3.5 rounded-xl bg-surface-2 border border-main-border-strong space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <UserCheck className="w-4 h-4 text-primary" />
                <span className="font-medium text-main-text">
                  Replacement Candidates for{' '}
                  <strong className="text-primary">
                    {coverTargetShift.userName}
                  </strong>{' '}
                  · {coverTargetShift.type} ({coverTargetShift.localDate})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCoverFinderShiftId(null)}
                className="text-xs text-main-text-muted hover:text-main-text cursor-pointer"
              >
                Close
              </button>
            </div>

            {coverCandidates.length === 0 ? (
              <p className="text-xs text-main-text-muted">
                All operators already have active working shifts on{' '}
                {coverTargetShift.localDate}.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {coverCandidates.map((cand) => (
                  <div
                    key={cand.user.uid}
                    className="p-2.5 rounded-lg bg-surface-1 border border-main-border flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-main-text truncate">
                        {cand.user.displayName || cand.user.email}
                      </p>
                      <p className="text-[11px] font-mono text-main-text-muted tabular-nums">
                        {cand.weeklyHours}h/wk · {cand.statusNote}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleAssignCoverCandidate(coverTargetShift, cand.user)
                      }
                      className="px-2.5 py-1 rounded bg-primary text-text-on-primary text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="glass-card overflow-hidden">
          {filteredShifts.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="max-w-sm mx-auto space-y-2">
                <p className="text-sm font-medium text-main-text">
                  No matching shifts found
                </p>
                <p className="text-xs text-main-text-muted">
                  Clear your active filter or switch the date scope in Tools to
                  view all entries.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectCategory('all');
                      setRosterDateScope('all');
                      setSearchQuery('');
                    }}
                    className="btn-secondary py-1.5 px-3 text-xs cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <TableVirtuoso
                ref={tableVirtuosoRef}
                style={{
                  height: Math.min(
                    640,
                    Math.max(260, filteredShifts.length * 58 + 46)
                  ),
                }}
                data={filteredShifts}
                overscan={240}
                computeItemKey={(_index, shift) => shift.id}
                components={{
                  Table: (props) => (
                    <table
                      {...props}
                      className="w-full text-left border-collapse text-sm"
                    />
                  ),
                  TableHead: React.forwardRef((props, ref) => (
                    <thead
                      {...props}
                      ref={ref}
                      className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur-xs"
                    />
                  )),
                  TableBody: React.forwardRef((props, ref) => (
                    <tbody
                      {...props}
                      ref={ref}
                      className="divide-y divide-main-border"
                    />
                  )),
                  TableRow: (props) => {
                    const idx = props['data-index'];
                    const shift = filteredShifts[idx];
                    if (!shift) return <tr {...props} />;
                    const isSelected = selectedShiftIds.has(shift.id);
                    const isKeyboardFocused = idx === focusedRowIndex;
                    const isStagedInSandbox = Boolean(
                      isSandboxMode &&
                        (stagedEdits[shift.id] ||
                          shift.id.startsWith('staged-'))
                    );

                    return (
                      <tr
                        {...props}
                        onClick={() => onInspectShift?.(shift)}
                        className={`group content-auto-row gpu-layer transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary-subtle/40'
                            : isKeyboardFocused
                            ? 'bg-primary-subtle/25 ring-1 ring-inset ring-primary/40'
                            : isStagedInSandbox
                            ? 'bg-warning-subtle/20 hover:bg-warning-subtle/30'
                            : 'hover:bg-surface-3/40'
                        }`}
                      />
                    );
                  },
                }}
                fixedHeaderContent={() => (
                  <tr className="border-b border-main-border bg-surface-2/95 text-[11px] font-medium uppercase tracking-wider text-main-text-muted">
                    <th className="py-3 px-4 w-10">
                      <button
                        type="button"
                        onClick={toggleSelectAllFiltered}
                        className="p-0.5 rounded text-main-text-muted hover:text-main-text transition-colors cursor-pointer"
                        aria-label="Select all visible shifts"
                      >
                        {allFilteredSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('operator')}
                        className="flex items-center gap-1 hover:text-main-text cursor-pointer"
                      >
                        <span>Operator</span>
                        {sortField === 'operator' && (
                          <span className="text-primary">
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('date')}
                        className="flex items-center gap-1 hover:text-main-text cursor-pointer"
                      >
                        <span>Date</span>
                        {sortField === 'date' && (
                          <span className="text-primary">
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('shiftType')}
                        className="flex items-center gap-1 hover:text-main-text cursor-pointer"
                      >
                        <span>Shift Type</span>
                        {sortField === 'shiftType' && (
                          <span className="text-primary">
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 min-w-[210px]">
                      <button
                        type="button"
                        onClick={() => toggleSort('duration')}
                        className="flex items-center gap-1 hover:text-main-text cursor-pointer"
                      >
                        <span>Hours</span>
                        {sortField === 'duration' && (
                          <span className="text-primary">
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    </th>
                  </tr>
                )}
                itemContent={(idx, s) => (
                  <RosterTableRowCells
                    shift={s}
                    isCurrentUser={s.userId === user?.uid}
                    isAdmin={Boolean(isAdmin)}
                    isSelected={selectedShiftIds.has(s.id)}
                    isKeyboardFocused={idx === focusedRowIndex}
                    isPopoverOpen={activePopoverShiftId === s.id}
                    isFinderOpen={coverFinderShiftId === s.id}
                    isStagedInSandbox={Boolean(
                      isSandboxMode &&
                        (stagedEdits[s.id] || s.id.startsWith('staged-'))
                    )}
                    todayStr={todayStr}
                    nowMinutes={nowMinutes}
                    userTimezone={userTimezone}
                    secondaryTimezone={secondaryTimezone}
                    onToggleSelect={toggleShiftSelection}
                    onInspectShift={onInspectShift}
                    onOpenPopover={setActivePopoverShiftId}
                    onApplyPresetToShift={handleApplyPresetToShift}
                    onOpenCoverFinder={setCoverFinderShiftId}
                  />
                )}
              />

              <div className="px-4 py-2 bg-surface-2 border-t border-main-border flex items-center justify-between text-[11px] font-mono text-main-text-muted tabular-nums">
                <span>{filteredShifts.length} shifts</span>
                <span>120fps virtualized</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // MODE 1: OVERVIEW (Calm Executive Summary)
  // ============================================================================
  if (mode === 'overview') {
    if (subTab === 'roster') {
      return (
        <div className="space-y-4">
          {renderSingleUnifiedCommandBar(true)}
          {renderEnterpriseRosterTable()}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Clean Minimalist Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-display font-bold text-main-text tracking-tight">
              Welcome back, {profile?.displayName?.split(' ')[0] || 'Team'}
            </h1>
            <p className="text-xs text-main-text-muted mt-0.5">
              {format(new Date(), 'EEEE, MMMM d, yyyy')} · {userTimezone}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('schedule')}
            className="btn-secondary py-1.5 px-3 text-xs self-start sm:self-auto cursor-pointer"
          >
            Open Schedule & Roster →
          </button>
        </div>

        {/* Row 1: Clean 4-Card KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() =>
              nextShift
                ? onInspectShift?.(nextShift)
                : onNavigate?.('schedule')
            }
            className="p-4 rounded-xl glass-card space-y-1.5 cursor-pointer hover:border-main-border-strong transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-main-text-muted">
              <span>My Next Shift</span>
              <Clock className="w-3.5 h-3.5 text-main-text-muted" />
            </div>
            {nextShift ? (
              <div>
                <p className="text-lg font-display font-bold text-main-text font-mono tabular-nums">
                  {nextShift.localStartTime} – {nextShift.localEndTime}
                </p>
                <p className="text-xs text-main-text-muted mt-0.5">
                  {nextShift.localDate === todayStr
                    ? 'Today'
                    : nextShift.localDate}{' '}
                  · {nextShift.type}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-display font-bold text-main-text">
                  No Active Shift
                </p>
                <p className="text-xs text-main-text-muted mt-0.5">
                  View full schedule
                </p>
              </div>
            )}
          </div>

          <div
            onClick={() => onSelectSubTab?.('roster')}
            className="p-4 rounded-xl glass-card space-y-1.5 cursor-pointer hover:border-main-border-strong transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-main-text-muted">
              <span>Floor Coverage Today</span>
              <Users className="w-3.5 h-3.5 text-main-text-muted" />
            </div>
            <p className="text-2xl font-display font-bold text-main-text font-mono tabular-nums">
              {todayActiveCount}
              <span className="text-xs font-sans font-normal text-main-text-muted ml-1.5">
                active today
              </span>
            </p>
            <p className="text-xs text-main-text-muted">
              {localizedShifts.length} total roster entries
            </p>
          </div>

          <div
            onClick={() => onNavigateModuleSubTab?.('schedule', 'matrix')}
            className="p-4 rounded-xl glass-card space-y-1.5 cursor-pointer hover:border-main-border-strong transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-main-text-muted">
              <span>Rest & Turnaround Health</span>
              <ShieldAlert className="w-3.5 h-3.5 text-main-text-muted" />
            </div>
            <p className="text-2xl font-display font-bold text-main-text font-mono tabular-nums">
              {teamHealthMetrics.avgEquity}%
            </p>
            <p className="text-xs text-main-text-muted">
              {teamHealthMetrics.clopenCount === 0
                ? 'Zero turnaround risks'
                : `${teamHealthMetrics.clopenCount} turnaround alert(s)`}
            </p>
          </div>

          <div
            onClick={() =>
              onNavigate?.(
                isAdmin && pendingLeaves.length > 0 ? 'admin' : 'requests'
              )
            }
            className="p-4 rounded-xl glass-card space-y-1.5 cursor-pointer hover:border-main-border-strong transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-main-text-muted">
              <span>
                {isAdmin ? 'Pending Leave Approvals' : 'Upcoming Shifts'}
              </span>
              <AlertCircle className="w-3.5 h-3.5 text-main-text-muted" />
            </div>
            <p className="text-2xl font-display font-bold text-main-text font-mono tabular-nums">
              {isAdmin ? pendingLeaves.length : myUpcomingShifts.length}
            </p>
            <p className="text-xs text-main-text-muted">
              {isAdmin ? 'Awaiting review' : 'Scheduled ahead'}
            </p>
          </div>
        </div>

        {/* Row 2: Compact Shift Summary Bar */}
        <div className="p-3 rounded-xl glass-card flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  id: 'first' as ShiftCategory,
                  label: '1st Shift',
                  count: categoryDistribution.first,
                  dot: 'bg-primary',
                },
                {
                  id: 'second' as ShiftCategory,
                  label: '2nd Shift',
                  count: categoryDistribution.second,
                  dot: 'bg-secondary',
                },
                {
                  id: 'third' as ShiftCategory,
                  label: '3rd Shift',
                  count: categoryDistribution.third,
                  dot: 'bg-info',
                },
                {
                  id: 'general' as ShiftCategory,
                  label: 'General',
                  count: categoryDistribution.general,
                  dot: 'bg-warning',
                },
                {
                  id: 'off' as ShiftCategory,
                  label: 'WO / CO',
                  count: categoryDistribution.off,
                  dot: 'bg-main-text-muted',
                },
              ]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  handleSelectCategory(item.id);
                  onSelectSubTab?.('roster');
                }}
                className="px-3 py-1.5 rounded-lg bg-surface-1 hover:bg-surface-3 border border-main-border text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                <span className="font-medium text-main-text">{item.label}</span>
                <span className="font-mono text-main-text-muted tabular-nums">
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onSelectSubTab?.('roster')}
            className="text-xs font-medium text-primary hover:underline cursor-pointer"
          >
            View All {localizedShifts.length} Entries →
          </button>
        </div>

        {/* Row 3: 2-Column Split (Today's Active Roster + Team Announcements) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-5 rounded-xl glass-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-semibold text-main-text">
                Today&apos;s Active Roster ({todayShifts.length})
              </h2>
              <button
                type="button"
                onClick={() => onSelectSubTab?.('roster')}
                className="text-xs font-medium text-main-text-muted hover:text-main-text cursor-pointer"
              >
                Full Roster
              </button>
            </div>

            {todayShifts.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-main-text-muted">
                  No shifts scheduled specifically for today ({todayStr}).
                </p>
                <button
                  type="button"
                  onClick={() => onSelectSubTab?.('roster')}
                  className="btn-secondary py-1.5 px-3 text-xs cursor-pointer"
                >
                  Browse Full Roster ({localizedShifts.length} shifts)
                </button>
              </div>
            ) : (
              <div className="divide-y divide-main-border">
                {todayShifts.slice(0, 8).map((s) => {
                  const badge = getShiftBadgeStyle(s.type);
                  const isOff = isTimeOffShift(
                    s.type,
                    s.localStartTime,
                    s.localEndTime
                  );
                  return (
                    <div
                      key={s.id}
                      onClick={() => onInspectShift?.(s)}
                      className="py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-3/30 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface-3 border border-main-border flex items-center justify-center text-xs font-semibold text-main-text shrink-0">
                          {getInitials(s.userName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-main-text truncate">
                            {s.userName}
                          </p>
                          <p className="text-[11px] text-main-text-muted font-mono tabular-nums">
                            {isOff
                              ? 'Rest Day'
                              : `${s.localStartTime} – ${s.localEndTime}`}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.badgeClass}`}
                      >
                        {s.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Team Announcements */}
          <div className="p-5 rounded-xl glass-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-semibold text-main-text">
                Team Announcements
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate?.('admin')}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  Post
                </button>
              )}
            </div>

            {announcements.length === 0 ? (
              <p className="text-xs text-main-text-muted py-6 text-center">
                No recent announcements posted.
              </p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg bg-surface-1 border border-main-border space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-main-text-muted">
                      <span className="font-medium text-main-text">
                        {a.authorName}
                      </span>
                      <span className="uppercase font-mono text-[10px]">
                        {a.priority}
                      </span>
                    </div>
                    <p className="text-xs text-main-text leading-relaxed">
                      {a.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MODE 2: SCHEDULE & ROSTER (Starts directly with Unified Command Bar)
  // ============================================================================
  return (
    <div className="space-y-4">
      {/* Single Unified Command Toolbar (Zero duplicate page headers or stacked banners) */}
      {renderSingleUnifiedCommandBar(subTab === 'list' || subTab === 'mine')}

      {/* Sub-View 1: Clean 7-Day Week Grid (Virtualized via Virtuoso + content-auto-card) */}
      {subTab === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(day, new Date());
            const dayShifts = weekDayShiftsMap[dateStr] || [];
            const activeFloorCount = dayShifts.filter(
              (s) => !isTimeOffShift(s.type, s.localStartTime, s.localEndTime)
            ).length;

            return (
              <div
                key={dateStr}
                className={`rounded-xl border p-2.5 flex flex-col min-h-[300px] ${
                  isToday
                    ? 'bg-surface-2 border-primary/40'
                    : 'bg-surface-2 border-main-border'
                }`}
              >
                {/* Clean Day Header */}
                <div className="pb-2 mb-2 border-b border-main-border flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-xs font-display font-semibold ${
                        isToday ? 'text-primary' : 'text-main-text'
                      }`}
                    >
                      {format(day, 'EEE')}
                    </span>
                    <span className="text-xs font-mono text-main-text-muted tabular-nums">
                      {format(day, 'd')}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-main-text-muted tabular-nums">
                    {activeFloorCount} active
                  </span>
                </div>

                {/* Virtualized Shift Cards (Name, Shift Badge, Hours Only) */}
                <div className="flex-1">
                  {dayShifts.length === 0 ? (
                    <p className="text-[11px] text-main-text-disabled py-8 text-center">
                      No shifts
                    </p>
                  ) : (
                    <Virtuoso
                      style={{
                        height: Math.min(
                          520,
                          Math.max(240, dayShifts.length * 60)
                        ),
                      }}
                      data={dayShifts}
                      overscan={180}
                      computeItemKey={(_index, shift) => shift.id}
                      itemContent={(_index, s) => (
                        <WeekGridShiftCard
                          shift={s}
                          onInspectShift={onInspectShift}
                        />
                      )}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-View 2: Clean 7-Day Shift Matrix */}
      {subTab === 'matrix' && (
        <CoverageFatigueMatrix
          weekDays={weekDays}
          users={users}
          shiftIndexMap={fullShiftIndexMap}
          workloadMap={workloadMap}
          currentUserId={user?.uid}
          isAdmin={Boolean(isAdmin)}
          dailyTarget={dailyTarget}
          slaMinPerWindow={slaMinPerWindow}
          searchQuery={deferredSearchQuery}
          onInspectShift={onInspectShift}
          onCycleCellShift={handleCycleMatrixCellShift}
          onRunAutopilotWeek={handleRunAutopilotWeek}
        />
      )}

      {/* Sub-View 3: Dedicated 24-Hour Orbital Chrono-Ring + Linear Timeline */}
      {subTab === 'timeline' && (
        <div className="space-y-4">
          <OrbitalChronoRing
            dateLabel={`${format(weekDays[0], 'MMM d')} – ${format(
              weekDays[6],
              'MMM d'
            )}`}
            dayShifts={filteredShifts}
            users={users}
            openIncidents={openIncidents}
            slaMinPerWindow={slaMinPerWindow}
            userTimezone={userTimezone}
            nowMinutes={nowMinutes}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
            onOpenHandoverBoard={() =>
              onNavigateModuleSubTab?.('support', 'handover')
            }
          />

          <div className="p-4 rounded-xl glass-card space-y-3 overflow-x-auto">
            <div className="min-w-[720px] space-y-2.5">
              <div className="grid grid-cols-12 text-[10px] font-mono text-main-text-muted pb-2 border-b border-main-border items-center">
                <div className="col-span-3">OPERATOR / DATE</div>
                <div className="col-span-9 grid grid-cols-8 text-center">
                  <span>00:00</span>
                  <span>03:00</span>
                  <span>07:30</span>
                  <span>09:00</span>
                  <span>12:30</span>
                  <span>16:30</span>
                  <span>18:00</span>
                  <span>20:30</span>
                </div>
              </div>

              {filteredShifts.length === 0 ? (
                <p className="text-xs text-main-text-muted py-8 text-center">
                  No shifts match the selected week and filter criteria.
                </p>
              ) : (
                filteredShifts.slice(0, 60).map((s) => {
                  const segments = computeMiniBarSegments(
                    s.localStartTime,
                    s.localEndTime,
                    s.type
                  );
                  const badge = getShiftBadgeStyle(s.type);
                  const isOff = isTimeOffShift(
                    s.type,
                    s.localStartTime,
                    s.localEndTime
                  );
                  const nowPct = (nowMinutes / 1440) * 100;

                  return (
                    <div
                      key={s.id}
                      onClick={() => onInspectShift?.(s)}
                      className="grid grid-cols-12 items-center gap-2 py-1 cursor-pointer hover:bg-surface-3/30 rounded-lg px-1 transition-colors"
                    >
                      <div className="col-span-3 pr-2 flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-surface-3 border border-main-border flex items-center justify-center text-[10px] font-semibold text-main-text shrink-0">
                          {getInitials(s.userName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-main-text truncate">
                            {s.userName}
                          </p>
                          <p className="text-[10px] font-mono text-main-text-muted tabular-nums">
                            {s.localDate}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-9 h-6 rounded-md bg-surface-1 border border-main-border relative overflow-hidden">
                        {s.localDate === todayStr && (
                          <div
                            style={{ left: `${nowPct}%` }}
                            className="absolute top-0 bottom-0 w-0.5 bg-error z-10"
                          />
                        )}
                        {segments.map((seg, idx) => (
                          <div
                            key={idx}
                            style={{
                              left: `${seg.leftPct}%`,
                              width: `${seg.widthPct}%`,
                            }}
                            className={`absolute top-0.5 bottom-0.5 rounded ${badge.barClass} flex items-center px-2 overflow-hidden`}
                          >
                            <span className="text-[10px] font-mono font-semibold text-text-on-primary truncate tabular-nums">
                              {isOff
                                ? `${s.type} (Rest)`
                                : `${s.type} · ${s.localStartTime}–${s.localEndTime}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-View 4 & 5: Clean 5-Column Roster Table ('list') and My Shifts ('mine') */}
      {(subTab === 'list' || subTab === 'mine') &&
        renderEnterpriseRosterTable()}

      <ShiftMigrationModal
        isOpen={showMigrationModal}
        onClose={() => setShowMigrationModal(false)}
      />
    </div>
  );
}
