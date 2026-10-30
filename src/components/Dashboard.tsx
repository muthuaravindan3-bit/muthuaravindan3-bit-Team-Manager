import { useReviewedRecords } from '../hooks/useReviewedRecords';
import { ReviewUpdates } from './ui/ReviewUpdates';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useTimezone } from '../TimezoneContext';
import {
  Shift,
  UserProfile,
  Announcement,
  GlobalSettings,
} from '../types';
import {
  Calendar,
  Clock,
  Coffee,
  Play,
  Square,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Smile,
  CheckCircle2,
  Megaphone,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
} from 'date-fns';
import { safeFormat } from '../utils/dateUtils';
import { WorkspaceTab, QuickDrawerType } from './Navigation';

interface DashboardProps {
  mode?: 'overview' | 'schedule';
  subTab?: string;
  onNavigate?: (tab: WorkspaceTab) => void;
  onSelectSubTab?: (subTab: string) => void;
  onOpenQuickDrawer?: (drawer: QuickDrawerType) => void;
  onInspectShift?: (shift: Shift) => void;
  focusDay?: string;
  onFocusDay?: (date: string) => void;
  externalWeekStart?: Date;
  onChangeExternalWeekStart?: (nextDate: Date) => void;
  externalTypeFilter?: string;
  onChangeExternalTypeFilter?: (type: string) => void;
  externalSearchQuery?: string;
  onChangeExternalSearchQuery?: (q: string) => void;
}

export default function Dashboard({
  focusDay,
  onFocusDay,
  mode = 'overview',
  subTab,
  onNavigate,
  onOpenQuickDrawer,
  onInspectShift,
  externalWeekStart,
  onChangeExternalWeekStart,
  externalTypeFilter,
  onChangeExternalTypeFilter,
  externalSearchQuery,
  onChangeExternalSearchQuery,
}: DashboardProps) {
  const { user, profile, isAdmin } = useAuth();
  const { userTimezone, convertToUserTime, convertToAppTime } = useTimezone();

  const [shifts, setShifts, shiftUpdates] = useReviewedRecords<Shift>();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    maxBreakDurationMinutes: 30,
    defaultHourlyRate: 25,
  });
  const [loading, setLoading] = useState(true);

  // Break tracking state
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(0);
  const [breakBusy, setBreakBusy] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Daily check-in state
  const [wellnessSubmitted, setWellnessSubmitted] = useState<string | null>(
    null
  );
  const [submittingWellness, setSubmittingWellness] = useState(false);

  // Schedule filters & view state
  const [internalWeekStart, setInternalWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [scheduleView, setScheduleView] = useState<'week' | 'list'>('week');
  const [memberFilter, setMemberFilter] = useState<'all' | 'mine'>('all');
  const [internalTypeFilter, setInternalTypeFilter] = useState<string>('all');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');

  const weekStart = externalWeekStart ?? internalWeekStart;
  const setWeekStart = onChangeExternalWeekStart ?? setInternalWeekStart;
  const typeFilter = externalTypeFilter ?? internalTypeFilter;
  const setTypeFilter = onChangeExternalTypeFilter ?? setInternalTypeFilter;
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = onChangeExternalSearchQuery ?? setInternalSearchQuery;

  useEffect(() => {
    if (mode === 'schedule' && subTab) {
      if (subTab === 'week') {
        setScheduleView('week');
        setMemberFilter('all');
      } else if (subTab === 'list') {
        setScheduleView('list');
        setMemberFilter('all');
      } else if (subTab === 'mine') {
        setScheduleView('list');
        setMemberFilter('mine');
      }
    }
  }, [mode, subTab]);

  // Quick Add Shift Modal (Admin fallback)
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [newShiftUserId, setNewShiftUserId] = useState('');
  const [newShiftDate, setNewShiftDate] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [newShiftStart, setNewShiftStart] = useState('09:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00');
  const [newShiftType, setNewShiftType] = useState('Morning');
  const [creatingShift, setCreatingShift] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubShifts = onSnapshot(
      collection(db, 'shifts'),
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Shift)
        );
        setShifts(list);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'shifts')
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ uid: d.id, ...d.data() } as UserProfile)
        );
        setUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubAnnouncements = onSnapshot(
      query(
        collection(db, 'announcements'),
        orderBy('createdAt', 'desc'),
        limit(5)
      ),
      (snap) => {
        setAnnouncements(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as GlobalSettings);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/global')
    );

    return () => {
      unsubShifts();
      unsubUsers();
      unsubAnnouncements();
      unsubSettings();
    };
  }, [user]);

  // Live break timer
  useEffect(() => {
    if (profile?.isBreakActive && profile?.breakStartTime) {
      const updateTimer = () => {
        const diff = Math.max(
          0,
          Math.floor((Date.now() - profile.breakStartTime!) / 1000)
        );
        setBreakElapsedSeconds(diff);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setBreakElapsedSeconds(0);
    }
  }, [profile?.isBreakActive, profile?.breakStartTime]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleToggleBreak = async () => {
    if (!user || breakBusy) return;
    setBreakBusy(true);
    try {
      if (!profile?.isBreakActive) {
        const now = Date.now();
        const initialPath: Array<{
          latitude: number;
          longitude: number;
          timestamp: number;
        }> = [];

        const logRef = await addDoc(collection(db, 'breakLogs'), {
          userId: user.uid,
          userName: profile?.displayName || user.displayName || 'Team Member',
          startTime: now,
          path: initialPath,
        });

        await updateDoc(doc(db, 'users', user.uid), {
          isBreakActive: true,
          activeBreakLogId: logRef.id,
          breakStartTime: now,
        });

        if ('geolocation' in navigator) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            async (pos) => {
              try {
                await updateDoc(doc(db, 'users', user.uid), {
                  lastLocation: {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    timestamp: Date.now(),
                  },
                });
              } catch {
                // Ignore transient location update errors
              }
            },
            () => {
              // Permission denied or unavailable
            },
            { enableHighAccuracy: false, maximumAge: 30000 }
          );
        }
      } else {
        const now = Date.now();
        const start = profile.breakStartTime || now;
        const durationMinutes = Math.max(1, Math.round((now - start) / 60000));

        if (profile.activeBreakLogId) {
          await updateDoc(doc(db, 'breakLogs', profile.activeBreakLogId), {
            endTime: now,
            duration: durationMinutes,
          });
        }

        await updateDoc(doc(db, 'users', user.uid), {
          isBreakActive: false,
          activeBreakLogId: null,
          breakStartTime: null,
        });

        if (watchIdRef.current !== null && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'breakLogs');
    } finally {
      setBreakBusy(false);
    }
  };

  const handleWellnessCheckIn = async (
    status: 'optimal' | 'stable' | 'stressed' | 'critical',
    score: number,
    label: string
  ) => {
    if (!user || submittingWellness) return;
    setSubmittingWellness(true);
    try {
      await addDoc(collection(db, 'wellness'), {
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Team Member',
        status,
        score,
        notes: `Daily check-in: ${label}`,
        timestamp: Date.now(),
      });
      setWellnessSubmitted(label);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'wellness');
    } finally {
      setSubmittingWellness(false);
    }
  };

  // Convert shifts to user's timezone
  const localizedShifts = useMemo(() => {
    return shifts
      .map((s) => {
        const startConv = convertToUserTime(s.date, s.startTime);
        const endConv = convertToUserTime(s.date, s.endTime);
        return {
          ...s,
          localDate: startConv.date,
          localStartTime: startConv.time,
          localEndTime: endConv.time,
        };
      })
      .sort((a, b) =>
        `${a.localDate}T${a.localStartTime}`.localeCompare(
          `${b.localDate}T${b.localStartTime}`
        )
      );
  }, [shifts, convertToUserTime]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const myUpcomingShifts = useMemo(() => {
    if (!user) return [];
    return localizedShifts.filter(
      (s) => s.userId === user.uid && s.localDate >= todayStr
    );
  }, [localizedShifts, user, todayStr]);

  const nextShift = myUpcomingShifts[0] || null;

  const todaysTeamShifts = useMemo(() => {
    return localizedShifts.filter((s) => {
      if (s.localDate !== todayStr) return false;
      if (
        mode === 'overview' &&
        subTab === 'roster' &&
        typeFilter !== 'all' &&
        s.type.toLowerCase() !== typeFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        mode === 'overview' &&
        subTab === 'roster' &&
        searchQuery.trim() &&
        !s.userName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.type.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [localizedShifts, todayStr, mode, subTab, typeFilter, searchQuery]);

  const filteredScheduleShifts = useMemo(() => {
    return localizedShifts.filter((s) => {
      if (memberFilter === 'mine' && s.userId !== user?.uid) return false;
      if (
        typeFilter !== 'all' &&
        s.type.toLowerCase() !== typeFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        searchQuery.trim() &&
        !s.userName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.type.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.localDate.includes(searchQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [localizedShifts, memberFilter, typeFilter, searchQuery, user?.uid]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const handleExportCSV = () => {
    const headers = [
      'Employee Name',
      'Date',
      'Start Time',
      'End Time',
      'Shift Type',
      'Timezone',
    ];
    const rows = filteredScheduleShifts.map((s) => [
      `"${s.userName.replace(/"/g, '""')}"`,
      s.localDate,
      s.localStartTime,
      s.localEndTime,
      s.type,
      userTimezone,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `team-schedule-${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateQuickShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newShiftUserId) return;
    setCreatingShift(true);
    try {
      const targetUser = users.find((u) => u.uid === newShiftUserId);
      const appStart = convertToAppTime(newShiftDate, newShiftStart);
      const appEnd = convertToAppTime(newShiftDate, newShiftEnd);

      await addDoc(collection(db, 'shifts'), {
        userId: newShiftUserId,
        userName:
          targetUser?.displayName || targetUser?.email || 'Team Member',
        date: appStart.date,
        startTime: appStart.time,
        endTime: appEnd.time,
        type: newShiftType,
        updatedAt: Date.now(),
      });
      setShowAddShiftModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    } finally {
      setCreatingShift(false);
    }
  };

  const handleDeleteShift = async (shiftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'shifts', shiftId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shifts/${shiftId}`);
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 rounded-xl bg-surface-2 border border-main-border animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-44 rounded-xl bg-surface-2 border border-main-border animate-pulse" />
          <div className="h-44 rounded-xl bg-surface-2 border border-main-border animate-pulse" />
        </div>
        <div className="h-72 rounded-xl bg-surface-2 border border-main-border animate-pulse" />
      </div>
    );
  }

  // ============================================================================
  // SCHEDULE MODE (Full Calendar & Roster Table with Interactive Shift Inspector)
  // ============================================================================
  if (mode === 'schedule') {
    return (
      <div className="space-y-5">
        {/* Clean Schedule Header & Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-main-border">
          <div>
            <h1 className="text-xl font-display font-bold text-main-text tracking-tight">
              Team Schedule
            </h1>
            <p className="text-xs text-main-text-muted mt-0.5">
              Timezone: {userTimezone} · Click any shift to inspect or propose a
              swap
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {scheduleView === 'week' && (
              <div className="flex items-center gap-1 bg-surface-2 border border-main-border rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 cursor-pointer"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
                  }
                  className="px-2.5 py-1 text-xs font-mono tabular-nums font-medium text-main-text hover:bg-surface-3 rounded-lg cursor-pointer"
                >
                  {format(weekDays[0], 'MMM d')} –{' '}
                  {format(weekDays[6], 'MMM d, yyyy')}
                </button>
                <button
                  type="button"
                  onClick={() => setWeekStart(addDays(weekStart, 7))}
                  className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 cursor-pointer"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by shift type"
              className="bg-surface-2 border border-main-border rounded-xl px-3 py-2 text-xs font-medium text-main-text focus:outline-none focus:border-primary"
            >
              <option value="all">All Shift Types</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Night">Night</option>
            </select>

            <div className="relative w-48 sm:w-56">
              <Search className="w-3.5 h-3.5 text-main-text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by member..."
                className="w-full bg-surface-2 border border-main-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-main-text placeholder:text-main-text-disabled focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenQuickDrawer) {
                    onOpenQuickDrawer('assign-shift');
                  } else {
                    if (!newShiftUserId && users.length > 0) {
                      setNewShiftUserId(users[0].uid);
                    }
                    setShowAddShiftModal(true);
                  }
                }}
                className="btn-primary flex items-center gap-1.5 py-1.5 px-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Shift</span>
              </button>
            )}
          </div>
        </div>

        <ReviewUpdates {...shiftUpdates} />
        {/* Week Grid or List View */}
        {scheduleView === 'week' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
            {weekDays.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isToday = isSameDay(day, new Date());
              const dayShifts = filteredScheduleShifts.filter(
                (s) => s.localDate === dayStr
              );

              return (
                <motion.div
                  key={dayStr}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: idx * 0.035,
                    ease: [0.0, 0.0, 0.2, 1],
                  }}
                  className={`glass-card p-3 flex flex-col min-h-[220px] ${
                    isToday ? 'border-primary ring-1 ring-primary/25' : ''
                  }`}
                >
                  <button type="button" aria-label={`Focus ${dayStr}`} aria-pressed={focusDay === dayStr} onClick={() => onFocusDay?.(dayStr)} className="w-full pb-2.5 mb-2.5 border-b border-main-border flex items-center justify-between">
                    <span
                      className={`text-xs font-display font-bold ${
                        isToday ? 'text-primary' : 'text-main-text'
                      }`}
                    >
                      {format(day, 'EEE')}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-main-text-muted">
                      {format(day, 'MMM d')}
                    </span>
                  </button>

                  <div className="space-y-2 flex-1">
                    {dayShifts.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-8 text-xs text-main-text-disabled">
                        No shifts
                      </div>
                    ) : (
                      dayShifts.map((shift) => {
                        const isMine = shift.userId === user?.uid;
                        return (
                          <div
                            key={shift.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onInspectShift?.(shift)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onInspectShift?.(shift);
                              }
                            }}
                            title="Click to inspect shift & quick actions"
                            className={`p-2.5 rounded-xl border text-xs transition-opacity group cursor-pointer ${
                              isMine
                                ? 'bg-primary-subtle border-primary/30 hover:border-primary'
                                : 'bg-surface-1 border-main-border hover:border-primary/40 hover:bg-surface-3/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-semibold text-main-text truncate group-hover:text-primary transition-colors">
                                {shift.userName}
                              </span>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleDeleteShift(shift.id, e)
                                  }
                                  aria-label="Remove shift" title="Remove shift"
                                  className="text-main-text-muted hover:text-error transition-opacity cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="font-mono text-[11px] tabular-nums text-main-text-muted mt-1">
                              {shift.localStartTime} – {shift.localEndTime}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[11px] text-secondary font-medium">
                                {shift.type}
                              </span>
                              <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                Inspect →
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            {filteredScheduleShifts.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-8 h-8 text-main-text-disabled mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-main-text">
                  No shifts match your current filter
                </h3>
                <p className="text-xs text-main-text-muted mt-1">
                  Try clearing your search filter or switching to the 7-Day Week
                  view.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-main-border text-xs font-semibold text-main-text-muted bg-surface-1/60">
                      <th className="py-3 px-4">Team Member</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Shift Type</th>
                      <th className="py-3 px-4 text-right">Local Hours</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-main-border text-sm">
                    {filteredScheduleShifts.map((shift) => (
                      <tr
                        key={shift.id}
                        onClick={() => onInspectShift?.(shift)}
                        className="hover:bg-surface-3/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-medium text-main-text">
                          {shift.userName}
                          {shift.userId === user?.uid && (
                            <span className="text-xs text-primary font-semibold ml-2">
                              · You
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-main-text-muted">
                          {shift.localDate}
                        </td>
                        <td className="py-3 px-4 text-xs text-secondary font-medium">
                          {shift.type}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-main-text text-right">
                          {shift.localStartTime} – {shift.localEndTime}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectShift?.(shift);
                              }}
                              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                            >
                              Inspect
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleDeleteShift(shift.id, e)
                                }
                                className="text-xs text-main-text-muted hover:text-error cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Quick Add Shift Modal for Admins */}
        {showAddShiftModal && isAdmin && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowAddShiftModal(false)}
          >
            <div
              className="w-full max-w-md bg-surface-2 border border-main-border rounded-xl shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-main-border">
                <h2 className="text-base font-semibold text-main-text">
                  Assign New Shift
                </h2>
                <p className="text-xs text-main-text-muted mt-0.5">
                  Times entered in your timezone ({userTimezone}) are
                  automatically synced for the team.
                </p>
              </div>
              <form
                onSubmit={handleCreateQuickShift}
                className="p-6 space-y-4"
              >
                <div>
                  <label htmlFor="dashboard-field-1" className="block text-xs font-medium text-main-text mb-1">
                    Team Member
                  </label>
                  <select id="dashboard-field-1"
                    required
                    value={newShiftUserId}
                    onChange={(e) => setNewShiftUserId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select a member...</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="dashboard-field-2" className="block text-xs font-medium text-main-text mb-1">
                      Date
                    </label>
                    <input id="dashboard-field-2"
                      type="date"
                      required
                      value={newShiftDate}
                      onChange={(e) => setNewShiftDate(e.target.value)}
                      className="input-field font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="dashboard-field-3" className="block text-xs font-medium text-main-text mb-1">
                      Shift Type
                    </label>
                    <select id="dashboard-field-3"
                      value={newShiftType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewShiftType(val);
                        if (val === 'Morning') {
                          setNewShiftStart('08:00');
                          setNewShiftEnd('16:00');
                        } else if (val === 'Afternoon') {
                          setNewShiftStart('16:00');
                          setNewShiftEnd('00:00');
                        } else if (val === 'Night') {
                          setNewShiftStart('00:00');
                          setNewShiftEnd('08:00');
                        }
                      }}
                      className="input-field"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Night">Night</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="dashboard-field-4" className="block text-xs font-medium text-main-text mb-1">
                      Start Time
                    </label>
                    <input id="dashboard-field-4"
                      type="time"
                      required
                      value={newShiftStart}
                      onChange={(e) => setNewShiftStart(e.target.value)}
                      className="input-field font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="dashboard-field-5" className="block text-xs font-medium text-main-text mb-1">
                      End Time
                    </label>
                    <input id="dashboard-field-5"
                      type="time"
                      required
                      value={newShiftEnd}
                      onChange={(e) => setNewShiftEnd(e.target.value)}
                      className="input-field font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddShiftModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingShift}
                    className="btn-primary"
                  >
                    {creatingShift ? 'Assigning...' : 'Save Shift'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // OVERVIEW MODE (Focused Essentials: My Next Shift, Break Timer & Today's Roster)
  // ============================================================================
  const firstName = (
    profile?.displayName ||
    user?.displayName ||
    'there'
  ).split(' ')[0];
  const activeBreaksCount = users.filter((u) => u.isBreakActive).length;

  return (
    <div className="space-y-6">
      {/* Clean Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-main-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-main-text tracking-tight">
            Good day, {firstName}
          </h1>
          <p className="text-xs sm:text-sm text-main-text-muted mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} · {userTimezone}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onOpenQuickDrawer
                ? onOpenQuickDrawer('swap')
                : onNavigate?.('requests')
            }
            className="btn-secondary py-2 px-3.5 text-xs"
          >
            Swap Shift
          </button>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>View Full Schedule</span>
            </button>
          )}
        </div>
      </div>

      {/* Focused Essentials: 2-Column Primary Status Strip with Staggered Spring Reveal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: My Next Shift */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.0, 0.0, 0.2, 1] }}
          onClick={() => {
            if (nextShift && onInspectShift) onInspectShift(nextShift);
          }}
          className={`glass-card p-6 flex flex-col justify-between ${
            nextShift ? 'cursor-pointer' : ''
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs text-main-text-muted mb-3">
              <span className="font-display font-semibold text-main-text flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary-subtle border border-primary/25 flex items-center justify-center text-primary">
                  <Calendar className="w-4 h-4" />
                </span>
                <span>My Next Shift</span>
              </span>
              <span className="font-mono text-[11px] tabular-nums px-2 py-0.5 rounded-md bg-surface-3 text-main-text-muted">
                {userTimezone}
              </span>
            </div>

            {nextShift ? (
              <div className="space-y-1.5 my-2">
                <div className="text-3xl font-mono font-bold tabular-nums text-main-text tracking-tight">
                  {nextShift.localStartTime} – {nextShift.localEndTime}
                </div>
                <p className="text-xs text-main-text-muted flex items-center gap-2">
                  <span>
                    {nextShift.localDate === todayStr
                      ? 'Today'
                      : safeFormat(
                          nextShift.localDate,
                          'EEEE, MMM d',
                          nextShift.localDate
                        )}
                  </span>
                  <span>·</span>
                  <span className="px-2 py-0.5 rounded bg-secondary-subtle border border-secondary/25 text-secondary font-semibold">
                    {nextShift.type} Shift
                  </span>
                </p>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm font-medium text-main-text">
                  No upcoming shifts assigned
                </p>
                <p className="text-xs text-main-text-muted mt-1">
                  Open the full schedule or check with your manager to add
                  shifts.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-main-border flex items-center justify-between">
            <span className="text-xs text-main-text-muted font-mono tabular-nums">
              {myUpcomingShifts.length} upcoming{' '}
              {myUpcomingShifts.length === 1 ? 'shift' : 'shifts'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (nextShift && onInspectShift) {
                  onInspectShift(nextShift);
                } else if (onOpenQuickDrawer) {
                  onOpenQuickDrawer('swap');
                } else {
                  onNavigate?.('requests');
                }
              }}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{nextShift ? 'Inspect or swap' : 'Open swap board'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>

        {/* Card 2: Rest Break Timer */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.28,
            delay: 0.06,
            ease: [0.0, 0.0, 0.2, 1],
          }}
          className="glass-card p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-main-text-muted mb-3">
              <span className="font-display font-semibold text-main-text flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-secondary-subtle border border-secondary/25 flex items-center justify-center text-secondary">
                  <Coffee className="w-4 h-4" />
                </span>
                <span>Rest Break Timer</span>
              </span>
              <span className="font-mono text-[11px] tabular-nums px-2 py-0.5 rounded-md bg-surface-3 text-main-text-muted">
                Max {settings.maxBreakDurationMinutes}m allowance
              </span>
            </div>

            {profile?.isBreakActive ? (
              <div className="space-y-1.5 my-2">
                <div className="text-3xl font-mono font-bold tabular-nums text-primary tracking-tight">
                  {formatTimer(breakElapsedSeconds)}
                </div>
                <p className="text-xs text-main-text-muted">
                  Active break · Started at{' '}
                  <span className="font-mono tabular-nums">
                    {profile.breakStartTime
                      ? safeFormat(profile.breakStartTime, 'HH:mm')
                      : '--:--'}
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 my-2">
                <div className="text-3xl font-display font-bold text-main-text tracking-tight">
                  On Duty
                </div>
                <p className="text-xs text-main-text-muted">
                  Start your timer when stepping away for a meal or rest break.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-main-border flex items-center justify-between">
            <span className="text-xs text-main-text-muted font-mono tabular-nums">
              {activeBreaksCount} teammate{activeBreaksCount === 1 ? '' : 's'}{' '}
              on break
            </span>
            <button
              type="button"
              disabled={breakBusy}
              onClick={handleToggleBreak}
              className={
                profile?.isBreakActive
                  ? 'btn-destructive flex items-center gap-1.5 py-1.5 px-3.5 text-xs'
                  : 'btn-primary flex items-center gap-1.5 py-1.5 px-3.5 text-xs'
              }
            >
              {profile?.isBreakActive ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>End Break</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Break</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Today's Team Roster Table */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.28,
          delay: 0.12,
          ease: [0.0, 0.0, 0.2, 1],
        }}
        className="glass-card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-main-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-display font-semibold text-main-text">
              Today’s Roster ({todaysTeamShifts.length})
            </h2>
            <p className="text-xs text-main-text-muted mt-0.5">
              Scheduled coverage for {format(new Date(), 'MMMM d, yyyy')}
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Full week calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {todaysTeamShifts.length === 0 ? (
          <div className="p-10 text-center">
            <Clock className="w-7 h-7 text-main-text-disabled mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-main-text">
              No shifts scheduled for today
            </h3>
            <p className="text-xs text-main-text-muted mt-1 max-w-md mx-auto">
              {isAdmin
                ? 'Open Workspace Admin or the Schedule view to assign shifts for today.'
                : 'Open the weekly schedule to view upcoming shift assignments.'}
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(isAdmin ? 'admin' : 'schedule')}
                className="btn-primary mt-4 text-xs"
              >
                {isAdmin ? 'Assign Shifts' : 'Open Weekly Schedule'}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-main-border text-xs font-semibold text-main-text-muted bg-surface-1/60">
                  <th className="py-3 px-6">Team Member</th>
                  <th className="py-3 px-6">Shift Type</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Local Hours</th>
                  <th className="py-3 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-main-border text-sm">
                {todaysTeamShifts.map((shift) => {
                  const memberDoc = users.find((u) => u.uid === shift.userId);
                  const isOnBreak = Boolean(memberDoc?.isBreakActive);
                  return (
                    <tr
                      key={shift.id}
                      onClick={() => onInspectShift?.(shift)}
                      className="hover:bg-surface-3/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-6 font-medium text-main-text">
                        {shift.userName}
                        {shift.userId === user?.uid && (
                          <span className="text-xs text-primary font-semibold ml-1.5">
                            · You
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-secondary font-medium">
                        {shift.type}
                      </td>
                      <td className="py-3.5 px-6 text-xs">
                        {isOnBreak ? (
                          <span className="px-2 py-0.5 rounded bg-warning-subtle text-warning font-semibold">
                            On Break
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-success-subtle text-success font-semibold">
                            Scheduled
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-xs tabular-nums text-main-text text-right">
                        {shift.localStartTime} – {shift.localEndTime}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <span className="text-xs font-semibold text-primary hover:underline">
                          Inspect →
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Compact Secondary Strip: Daily Check-In & Latest Announcement */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.28,
          delay: 0.16,
          ease: [0.0, 0.0, 0.2, 1],
        }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Compact Daily Check-In */}
        <div className="glass-card px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Smile className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-main-text">Shift Check-In:</span>
            {wellnessSubmitted ? (
              <span className="text-success font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{wellnessSubmitted}</span>
              </span>
            ) : (
              <span className="text-main-text-muted">How is your workload?</span>
            )}
          </div>

          {wellnessSubmitted ? (
            <button
              type="button"
              onClick={() => setWellnessSubmitted(null)}
              className="text-xs font-medium text-primary hover:underline cursor-pointer self-start sm:self-auto"
            >
              Change status
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { status: 'optimal' as const, score: 95, label: 'Great' },
                { status: 'stable' as const, score: 80, label: 'Steady' },
                { status: 'stressed' as const, score: 55, label: 'Busy' },
                {
                  status: 'critical' as const,
                  score: 30,
                  label: 'Need Backup',
                },
              ].map((opt) => (
                <button
                  key={opt.status}
                  type="button"
                  disabled={submittingWellness}
                  onClick={() =>
                    handleWellnessCheckIn(opt.status, opt.score, opt.label)
                  }
                  className="px-2.5 py-1 rounded-lg bg-surface-1 border border-main-border hover:border-primary text-xs font-medium text-main-text transition-colors cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Latest Team Announcement (or Quiet Status Note) */}
        <div className="glass-card px-5 py-3.5 flex items-center justify-between gap-3">
          {announcements.length > 0 ? (
            <div className="flex items-center gap-2.5 min-w-0 text-xs">
              <Megaphone className="w-4 h-4 text-secondary shrink-0" />
              <p className="text-main-text truncate">
                <span className="font-semibold mr-1.5">Announcement:</span>
                {announcements[0].content}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-main-text-muted">
              <Megaphone className="w-4 h-4 text-main-text-disabled shrink-0" />
              <span>No active team announcements for today.</span>
            </div>
          )}
          {announcements.length > 0 && (
            <span className="text-[11px] font-mono tabular-nums text-main-text-muted shrink-0">
              {safeFormat(announcements[0].createdAt, 'MMM d')}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
