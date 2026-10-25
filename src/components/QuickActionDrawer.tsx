import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  arrayUnion,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useTimezone } from '../TimezoneContext';
import { useTheme } from '../ThemeContext';
import { useToast } from '../ToastContext';
import { Shift, UserProfile, BreakLog, GlobalSettings } from '../types';
import { QuickDrawerType } from './Navigation';
import {
  X,
  ArrowLeftRight,
  CalendarOff,
  Coffee,
  Play,
  Square,
  Plus,
  User,
  Globe,
  Sun,
  Moon,
  Check,
  Clock,
  Calendar,
  Trash2,
  Edit3,
  MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import { safeFormat } from '../utils/dateUtils';

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

interface QuickActionDrawerProps {
  activeDrawer: QuickDrawerType;
  inspectedShift?: Shift | null;
  onSwitchDrawer?: (drawer: QuickDrawerType) => void;
  onClose: () => void;
}

export default function QuickActionDrawer({
  activeDrawer,
  inspectedShift,
  onSwitchDrawer,
  onClose,
}: QuickActionDrawerProps) {
  const { user, profile, isAdmin } = useAuth();
  const { userTimezone, convertToUserTime, convertToAppTime } = useTimezone();
  const { theme, setTheme, availableThemes } = useTheme();
  const { showToast } = useToast();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [myBreaks, setMyBreaks] = useState<BreakLog[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    maxBreakDurationMinutes: 30,
    defaultHourlyRate: 25,
  });

  // Swap Form State
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [preferredTypes, setPreferredTypes] = useState<string[]>([
    '1st Shift',
    '2nd Shift',
    'General',
  ]);
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);

  // Leave Form State
  const [leaveStart, setLeaveStart] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [leaveEnd, setLeaveEnd] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState(false);

  // Break Timer State
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(0);
  const [breakBusy, setBreakBusy] = useState(false);

  // Assign Shift State (Admin)
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDate, setAssignDate] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [assignStart, setAssignStart] = useState('06:00');
  const [assignEnd, setAssignEnd] = useState('14:00');
  const [assignType, setAssignType] = useState('1st Shift');
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Inspect Shift Admin Edit State
  const [editUserId, setEditUserId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editType, setEditType] = useState('Morning');
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [confirmDeleteShift, setConfirmDeleteShift] = useState(false);

  // Settings Form State
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const allTimezones = useMemo(
    () => Array.from(new Set([browserTz, ...COMMON_TIMEZONES])).sort(),
    [browserTz]
  );
  const [displayName, setDisplayName] = useState(
    profile?.displayName || user?.displayName || ''
  );
  const [employeeId, setEmployeeId] = useState(profile?.employeeId || '');
  const [timezone, setTimezone] = useState(profile?.timezone || browserTz);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Sync profile fields when opened
  useEffect(() => {
    if (profile || user) {
      setDisplayName(profile?.displayName || user?.displayName || '');
      setEmployeeId(profile?.employeeId || '');
      setTimezone(profile?.timezone || browserTz);
    }
  }, [profile, user, browserTz, activeDrawer]);

  // Populate Inspect Shift Edit fields when inspectedShift changes
  useEffect(() => {
    if (inspectedShift) {
      const startConv = convertToUserTime(
        inspectedShift.date,
        inspectedShift.startTime
      );
      const endConv = convertToUserTime(
        inspectedShift.date,
        inspectedShift.endTime
      );
      setEditUserId(inspectedShift.userId);
      setEditDate(startConv.date);
      setEditStart(startConv.time);
      setEditEnd(endConv.time);
      setEditType(inspectedShift.type);
      setConfirmDeleteShift(false);
      setEditSaved(false);
    }
  }, [inspectedShift, convertToUserTime]);

  // Close on Escape key
  useEffect(() => {
    if (!activeDrawer) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDrawer, onClose]);

  // Subscribe to required data when drawer is open
  useEffect(() => {
    if (!user || !activeDrawer) return;

    const unsubShifts = onSnapshot(
      collection(db, 'shifts'),
      (snap) => {
        setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift)));
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
        if (list.length > 0 && !assignUserId) {
          setAssignUserId(list[0].uid);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubBreaks = onSnapshot(
      query(collection(db, 'breakLogs'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as BreakLog))
          .sort((a, b) => b.startTime - a.startTime);
        setMyBreaks(list.slice(0, 6));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'breakLogs')
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as GlobalSettings);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/global')
    );

    return () => {
      unsubShifts();
      unsubUsers();
      unsubBreaks();
      unsubSettings();
    };
  }, [user, activeDrawer]);

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

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const myUpcomingShifts = useMemo(() => {
    if (!user) return [];
    return shifts
      .filter((s) => s.userId === user.uid && s.date >= todayStr)
      .map((s) => {
        const startConv = convertToUserTime(s.date, s.startTime);
        const endConv = convertToUserTime(s.date, s.endTime);
        return {
          ...s,
          localDate: startConv.date,
          localTime: `${startConv.time} – ${endConv.time}`,
        };
      })
      .sort((a, b) => a.localDate.localeCompare(b.localDate));
  }, [shifts, user, todayStr, convertToUserTime]);

  useEffect(() => {
    if (myUpcomingShifts.length > 0 && !selectedShiftId) {
      setSelectedShiftId(myUpcomingShifts[0].id);
    }
  }, [myUpcomingShifts, selectedShiftId]);

  if (!activeDrawer) return null;

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const togglePreferredType = (t: string) => {
    setPreferredTypes((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const handleCreateSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedShiftId || swapSubmitting) return;
    const shift = myUpcomingShifts.find((s) => s.id === selectedShiftId);
    if (!shift) return;

    setSwapSubmitting(true);
    try {
      const createdRef = await addDoc(collection(db, 'shiftSwaps'), {
        requesterId: user.uid,
        requesterName:
          profile?.displayName || user.displayName || 'Team Member',
        shiftId: shift.id,
        shiftDate: shift.localDate,
        shiftTime: shift.localTime,
        preferredTypes,
        status: 'pending',
        createdAt: Date.now(),
      });
      setSwapSuccess(true);
      showToast({
        type: 'success',
        title: 'Shift swap posted to marketplace',
        description: `${shift.localDate} · ${shift.localTime}`,
        liveBadge: 'OPEN SWAP',
        onUndo: async () => {
          await deleteDoc(doc(db, 'shiftSwaps', createdRef.id));
        },
      });
      setTimeout(() => {
        setSwapSuccess(false);
        onClose();
      }, 450);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shiftSwaps');
    } finally {
      setSwapSubmitting(false);
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !leaveReason.trim() || leaveSubmitting) return;
    setLeaveSubmitting(true);
    const effectiveEnd = leaveEnd < leaveStart ? leaveStart : leaveEnd;
    try {
      const createdRef = await addDoc(collection(db, 'leaveRequests'), {
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Team Member',
        startDate: leaveStart,
        endDate: effectiveEnd,
        reason: leaveReason.trim(),
        status: 'pending',
        createdAt: Date.now(),
      });
      setLeaveReason('');
      setLeaveSuccess(true);
      showToast({
        type: 'success',
        title: 'Leave request submitted',
        description: `${leaveStart} → ${effectiveEnd}`,
        liveBadge: 'PENDING APPROVAL',
        onUndo: async () => {
          await deleteDoc(doc(db, 'leaveRequests', createdRef.id));
        },
      });
      setTimeout(() => {
        setLeaveSuccess(false);
        onClose();
      }, 450);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'leaveRequests');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleSyncGps = () => {
    if (!user || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const point = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: Date.now(),
          };
          await updateDoc(doc(db, 'users', user.uid), {
            lastLocation: point,
          });
          if (profile?.activeBreakLogId) {
            await updateDoc(doc(db, 'breakLogs', profile.activeBreakLogId), {
              path: arrayUnion(point),
            });
          }
          showToast({
            type: 'info',
            title: 'Live GPS coordinates synced',
            description: `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`,
            liveBadge: 'GPS SYNCED',
          });
        } catch {
          // Ignore transient GPS write errors
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleToggleBreak = async () => {
    if (!user || breakBusy) return;
    setBreakBusy(true);
    try {
      if (!profile?.isBreakActive) {
        const now = Date.now();
        const logRef = await addDoc(collection(db, 'breakLogs'), {
          userId: user.uid,
          userName: profile?.displayName || user.displayName || 'Team Member',
          startTime: now,
          path: [],
        });

        await updateDoc(doc(db, 'users', user.uid), {
          isBreakActive: true,
          activeBreakLogId: logRef.id,
          breakStartTime: now,
        });

        showToast({
          type: 'info',
          title: 'Rest break started',
          description: `Allowance: ${settings.maxBreakDurationMinutes}m`,
          liveBadge: 'ON BREAK',
          onUndo: async () => {
            await deleteDoc(doc(db, 'breakLogs', logRef.id));
            await updateDoc(doc(db, 'users', user.uid), {
              isBreakActive: false,
              activeBreakLogId: null,
              breakStartTime: null,
            });
          },
        });
      } else {
        const now = Date.now();
        const prevStart = profile.breakStartTime || now;
        const prevLogId = profile.activeBreakLogId || null;
        const durationMinutes = Math.max(
          1,
          Math.round((now - prevStart) / 60000)
        );

        if (prevLogId) {
          await updateDoc(doc(db, 'breakLogs', prevLogId), {
            endTime: now,
            duration: durationMinutes,
          });
        }

        await updateDoc(doc(db, 'users', user.uid), {
          isBreakActive: false,
          activeBreakLogId: null,
          breakStartTime: null,
        });

        showToast({
          type: 'success',
          title: 'Break ended · Back on duty',
          description: `Logged ${durationMinutes} min rest break`,
          liveBadge: 'ON DUTY',
          onUndo: async () => {
            await updateDoc(doc(db, 'users', user.uid), {
              isBreakActive: true,
              activeBreakLogId: prevLogId,
              breakStartTime: prevStart,
            });
          },
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'breakLogs');
    } finally {
      setBreakBusy(false);
    }
  };

  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !assignUserId || assignBusy) return;
    setAssignBusy(true);
    try {
      const targetUser = users.find((u) => u.uid === assignUserId);
      const appStart = convertToAppTime(assignDate, assignStart);
      const appEnd = convertToAppTime(assignDate, assignEnd);
      const memberName =
        targetUser?.displayName || targetUser?.email || 'Team Member';

      const createdRef = await addDoc(collection(db, 'shifts'), {
        userId: assignUserId,
        userName: memberName,
        date: appStart.date,
        startTime: appStart.time,
        endTime: appEnd.time,
        type: assignType,
        updatedAt: Date.now(),
      });
      setAssignSuccess(true);
      showToast({
        type: 'success',
        title: `Assigned ${assignType} shift to ${memberName}`,
        description: `${assignDate} · ${assignStart} – ${assignEnd}`,
        liveBadge: 'SHIFT ASSIGNED',
        onUndo: async () => {
          await deleteDoc(doc(db, 'shifts', createdRef.id));
        },
      });
      setTimeout(() => {
        setAssignSuccess(false);
        onClose();
      }, 450);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    } finally {
      setAssignBusy(false);
    }
  };

  const handleUpdateInspectedShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !inspectedShift || editSaving) return;
    setEditSaving(true);
    const snapshotBefore = { ...inspectedShift };
    try {
      const targetUser = users.find((u) => u.uid === editUserId);
      const appStart = convertToAppTime(editDate, editStart);
      const appEnd = convertToAppTime(editDate, editEnd);
      const nextName =
        targetUser?.displayName ||
        targetUser?.email ||
        inspectedShift.userName;

      await updateDoc(doc(db, 'shifts', inspectedShift.id), {
        userId: editUserId,
        userName: nextName,
        date: appStart.date,
        startTime: appStart.time,
        endTime: appEnd.time,
        type: editType,
        updatedAt: Date.now(),
      });
      setEditSaved(true);
      showToast({
        type: 'success',
        title: `Updated shift for ${nextName}`,
        description: `${editDate} · ${editStart} – ${editEnd} (${editType})`,
        liveBadge: 'UPDATED',
        onUndo: async () => {
          await updateDoc(doc(db, 'shifts', snapshotBefore.id), {
            userId: snapshotBefore.userId,
            userName: snapshotBefore.userName,
            date: snapshotBefore.date,
            startTime: snapshotBefore.startTime,
            endTime: snapshotBefore.endTime,
            type: snapshotBefore.type,
            updatedAt: Date.now(),
          });
        },
      });
      setTimeout(() => {
        setEditSaved(false);
        onClose();
      }, 450);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `shifts/${inspectedShift.id}`
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteInspectedShift = async () => {
    if (!isAdmin || !inspectedShift) return;
    const deletedShift = { ...inspectedShift };
    try {
      await deleteDoc(doc(db, 'shifts', inspectedShift.id));
      onClose();
      showToast({
        type: 'warning',
        title: `Deleted ${deletedShift.userName}'s shift`,
        description: `${deletedShift.date} · ${deletedShift.type}`,
        liveBadge: 'REMOVED',
        onUndo: async () => {
          await setDoc(doc(db, 'shifts', deletedShift.id), {
            userId: deletedShift.userId,
            userName: deletedShift.userName,
            date: deletedShift.date,
            startTime: deletedShift.startTime,
            endTime: deletedShift.endTime,
            type: deletedShift.type,
            updatedAt: Date.now(),
          });
        },
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `shifts/${inspectedShift.id}`
      );
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || savingSettings) return;
    setSavingSettings(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim() || user.displayName || 'Team Member',
        employeeId: employeeId.trim() || null,
        timezone,
      });
      setSettingsSaved(true);
      showToast({
        type: 'success',
        title: 'Workspace preferences saved',
        description: `Timezone: ${timezone}`,
        liveBadge: 'SYNCED',
      });
      setTimeout(() => {
        setSettingsSaved(false);
        onClose();
      }, 450);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const drawerMeta: Record<
    Exclude<QuickDrawerType, null>,
    {
      title: string;
      subtitle: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    swap: {
      title: 'Post a Shift Swap',
      subtitle: 'Offer one of your upcoming shifts for a teammate to cover.',
      icon: ArrowLeftRight,
    },
    leave: {
      title: 'Request Time Off',
      subtitle: 'Submit personal, vacation, or medical leave for approval.',
      icon: CalendarOff,
    },
    break: {
      title: 'Live Break Tracker',
      subtitle: `Track rest or meal breaks (Standard allowance: ${settings.maxBreakDurationMinutes}m).`,
      icon: Coffee,
    },
    'assign-shift': {
      title: 'Quick Assign Shift',
      subtitle: `Assign a new shift in your local timezone (${userTimezone}).`,
      icon: Plus,
    },
    settings: {
      title: 'Profile, Timezone & Theme',
      subtitle:
        'Customize your display profile, local clock, and surface palette.',
      icon: User,
    },
    'inspect-shift': {
      title: 'Shift Inspector',
      subtitle: 'Shift details, local timezone conversion, and quick actions.',
      icon: Calendar,
    },
  };

  const currentMeta = drawerMeta[activeDrawer];
  const HeaderIcon = currentMeta.icon;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-drawer-title"
    >
      <div
        className="w-full max-w-md h-full bg-surface-2 border-l border-main-border shadow-2xl flex flex-col justify-between overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-main-border flex items-start justify-between gap-4 sticky top-0 bg-surface-2/95 backdrop-blur-md z-10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-subtle border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5">
              <HeaderIcon className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="quick-drawer-title"
                className="text-base font-display font-bold text-main-text"
              >
                {currentMeta.title}
              </h2>
              <p className="text-xs text-main-text-muted mt-0.5">
                {currentMeta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 p-6">
          {/* 0. SHIFT INSPECTOR DRAWER */}
          {activeDrawer === 'inspect-shift' && (
            <div className="space-y-6">
              {!inspectedShift ? (
                <div className="p-4 rounded-xl bg-surface-1 border border-main-border text-xs text-main-text-muted">
                  Select a shift card on the schedule to inspect its details.
                </div>
              ) : (
                (() => {
                  const startConv = convertToUserTime(
                    inspectedShift.date,
                    inspectedShift.startTime
                  );
                  const endConv = convertToUserTime(
                    inspectedShift.date,
                    inspectedShift.endTime
                  );
                  const assignedMember = users.find(
                    (u) => u.uid === inspectedShift.userId
                  );
                  const isMyShift = inspectedShift.userId === user?.uid;

                  return (
                    <>
                      {/* Primary Shift Summary Card */}
                      <div className="p-5 rounded-xl bg-surface-1 border border-main-border space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                              {inspectedShift.type} Shift
                            </span>
                            <h3 className="text-lg font-display font-bold text-main-text mt-0.5">
                              {inspectedShift.userName}
                              {isMyShift && (
                                <span className="text-xs text-primary font-semibold ml-1.5">
                                  · Assigned to You
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-main-text-muted">
                              {assignedMember?.role === 'admin'
                                ? 'Workspace Manager'
                                : 'Team Member'}
                              {assignedMember?.employeeId
                                ? ` · #${assignedMember.employeeId}`
                                : ''}
                            </p>
                          </div>

                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                              assignedMember?.isBreakActive
                                ? 'bg-warning-subtle text-warning border-warning/30'
                                : startConv.date === todayStr
                                ? 'bg-success-subtle text-success border-success/30'
                                : 'bg-surface-2 text-main-text-muted border-main-border'
                            }`}
                          >
                            {assignedMember?.isBreakActive
                              ? 'On Break'
                              : startConv.date === todayStr
                              ? 'Today'
                              : startConv.date > todayStr
                              ? 'Upcoming'
                              : 'Completed'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-main-border">
                          <div>
                            <p className="text-[11px] text-main-text-muted">
                              Local Date ({userTimezone})
                            </p>
                            <p className="text-sm font-mono font-bold tabular-nums text-main-text mt-0.5">
                              {startConv.date}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-main-text-muted">
                              Local Shift Window
                            </p>
                            <p className="text-sm font-mono font-bold tabular-nums text-primary mt-0.5">
                              {startConv.time} – {endConv.time}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions for This Shift */}
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-main-text-disabled">
                          Quick Actions for This Shift
                        </p>

                        <div className="grid grid-cols-1 gap-2">
                          {isMyShift && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedShiftId(inspectedShift.id);
                                onSwitchDrawer?.('swap');
                              }}
                              className="btn-primary py-2.5 px-4 text-xs flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <ArrowLeftRight className="w-4 h-4" />
                                <span>Offer This Shift for Swap</span>
                              </span>
                              <span className="font-mono text-[11px] opacity-80">
                                Pre-filled →
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setLeaveStart(startConv.date);
                              setLeaveEnd(startConv.date);
                              onSwitchDrawer?.('leave');
                            }}
                            className="btn-secondary py-2.5 px-4 text-xs flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <CalendarOff className="w-4 h-4 text-primary" />
                              <span>
                                Request Time Off for {startConv.date}
                              </span>
                            </span>
                            <span className="font-mono text-[11px] text-main-text-muted">
                              Pre-filled →
                            </span>
                          </button>

                          {isMyShift && startConv.date === todayStr && (
                            <button
                              type="button"
                              onClick={() => onSwitchDrawer?.('break')}
                              className="btn-secondary py-2.5 px-4 text-xs flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <Coffee className="w-4 h-4 text-primary" />
                                <span>
                                  {profile?.isBreakActive
                                    ? 'Manage Active Rest Break'
                                    : 'Start Rest Break Timer'}
                                </span>
                              </span>
                              <span className="font-mono text-[11px] text-main-text-muted">
                                Timer →
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Admin Inline Edit & Reassignment Section */}
                      {isAdmin && (
                        <form
                          onSubmit={handleUpdateInspectedShift}
                          className="p-4 rounded-xl bg-surface-1 border border-main-border space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-main-text flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-primary" />
                              <span>Manager Controls · Edit or Reassign</span>
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-main-text mb-1">
                              Assigned Team Member
                            </label>
                            <select
                              value={editUserId}
                              onChange={(e) => setEditUserId(e.target.value)}
                              className="input-field text-xs"
                            >
                              {users.map((u) => (
                                <option key={u.uid} value={u.uid}>
                                  {u.displayName || u.email}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-main-text mb-1">
                                Date
                              </label>
                              <input
                                type="date"
                                required
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="input-field font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-main-text mb-1">
                                Shift Type
                              </label>
                              <select
                                value={editType}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditType(val);
                                  if (val === '1st Shift' || val === 'Morning') {
                                    setEditStart('06:00');
                                    setEditEnd('14:00');
                                  } else if (val === '2nd Shift' || val === 'Afternoon') {
                                    setEditStart('14:00');
                                    setEditEnd('22:00');
                                  } else if (val === '3rd Shift' || val === 'Night') {
                                    setEditStart('22:00');
                                    setEditEnd('06:00');
                                  } else if (val === 'General') {
                                    setEditStart('09:00');
                                    setEditEnd('18:00');
                                  } else if (val === 'WO') {
                                    setEditStart('00:00');
                                    setEditEnd('00:00');
                                  } else if (val === 'CO') {
                                    setEditStart('09:00');
                                    setEditEnd('17:00');
                                  }
                                }}
                                className="input-field text-xs"
                              >
                                <option value="1st Shift">1st Shift (06:00–14:00)</option>
                                <option value="2nd Shift">2nd Shift (14:00–22:00)</option>
                                <option value="3rd Shift">3rd Shift (22:00–06:00)</option>
                                <option value="General">General (09:00–18:00)</option>
                                <option value="WO">WO (Week Off)</option>
                                <option value="CO">CO (Comp Off)</option>
                                <option value="Morning">Morning</option>
                                <option value="Afternoon">Afternoon</option>
                                <option value="Night">Night</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-main-text mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                required
                                value={editStart}
                                onChange={(e) => setEditStart(e.target.value)}
                                className="input-field font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-main-text mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                required
                                value={editEnd}
                                onChange={(e) => setEditEnd(e.target.value)}
                                className="input-field font-mono text-xs"
                              />
                            </div>
                          </div>

                          <div className="pt-2 flex items-center justify-between gap-2">
                            {!confirmDeleteShift ? (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteShift(true)}
                                className="btn-secondary text-error hover:border-error text-xs flex items-center gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Shift</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleDeleteInspectedShift}
                                  className="btn-destructive py-1.5 px-2.5 text-xs"
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteShift(false)}
                                  className="btn-secondary py-1.5 px-2.5 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={editSaving}
                              className="btn-primary text-xs flex items-center gap-1.5"
                            >
                              {editSaved ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Updated</span>
                                </>
                              ) : editSaving ? (
                                <span>Saving...</span>
                              ) : (
                                <span>Save Changes</span>
                              )}
                            </button>
                          </div>
                        </form>
                      )}
                    </>
                  );
                })()
              )}
            </div>
          )}

          {/* 1. SHIFT SWAP DRAWER */}
          {activeDrawer === 'swap' && (
            <form onSubmit={handleCreateSwap} className="space-y-5">
              {myUpcomingShifts.length === 0 ? (
                <div className="p-4 rounded-xl bg-surface-1 border border-main-border text-xs text-main-text-muted leading-relaxed">
                  You have no upcoming shifts scheduled to trade right now. Once
                  a shift is assigned to you, you can offer it here.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-main-text mb-1.5">
                      Select Your Shift to Trade
                    </label>
                    <select
                      required
                      value={selectedShiftId}
                      onChange={(e) => setSelectedShiftId(e.target.value)}
                      className="input-field font-mono text-xs"
                    >
                      {myUpcomingShifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.localDate} · {s.localTime} ({s.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-main-text mb-2">
                      Preferred Shift Types in Return
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        '1st Shift',
                        '2nd Shift',
                        '3rd Shift',
                        'General',
                        'WO',
                        'CO',
                      ].map((t) => {
                        const isSelected = preferredTypes.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => togglePreferredType(t)}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-primary-subtle border-primary text-primary'
                                : 'bg-surface-1 border-main-border text-main-text-muted hover:text-main-text'
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-main-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={swapSubmitting || myUpcomingShifts.length === 0}
                  className="btn-primary flex items-center gap-1.5"
                >
                  {swapSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Swap Posted</span>
                    </>
                  ) : swapSubmitting ? (
                    <span>Posting...</span>
                  ) : (
                    <span>Post Swap Request</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 2. LEAVE REQUEST DRAWER */}
          {activeDrawer === 'leave' && (
            <form onSubmit={handleCreateLeave} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-main-text mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveStart}
                    onChange={(e) => {
                      setLeaveStart(e.target.value);
                      if (leaveEnd < e.target.value) setLeaveEnd(e.target.value);
                    }}
                    className="input-field font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-main-text mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    min={leaveStart}
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="input-field font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-main-text mb-1.5">
                  Reason or Note for Manager
                </label>
                <textarea
                  required
                  rows={3}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Family trip, medical appointment, personal leave..."
                  className="input-field"
                />
              </div>

              <div className="pt-4 border-t border-main-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leaveSubmitting || !leaveReason.trim()}
                  className="btn-primary flex items-center gap-1.5"
                >
                  {leaveSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Submitted</span>
                    </>
                  ) : leaveSubmitting ? (
                    <span>Submitting...</span>
                  ) : (
                    <span>Submit Leave Request</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 3. BREAK TIMER DRAWER */}
          {activeDrawer === 'break' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-surface-1 border border-main-border text-center space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-main-text-muted">
                  {profile?.isBreakActive
                    ? 'Break in Progress'
                    : 'Rest Break Timer'}
                </div>
                <div className="text-4xl font-mono font-bold tabular-nums text-primary">
                  {profile?.isBreakActive
                    ? formatTimer(breakElapsedSeconds)
                    : '00:00'}
                </div>
                <p className="text-xs text-main-text-muted">
                  {profile?.isBreakActive && profile.breakStartTime
                    ? `Started at ${safeFormat(profile.breakStartTime, 'HH:mm')}`
                    : `Standard break allowance is ${settings.maxBreakDurationMinutes} minutes.`}
                </p>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    disabled={breakBusy}
                    onClick={handleToggleBreak}
                    className={
                      profile?.isBreakActive
                        ? 'btn-destructive w-full py-2.5 flex items-center justify-center gap-2'
                        : 'btn-primary w-full py-2.5 flex items-center justify-center gap-2'
                    }
                  >
                    {profile?.isBreakActive ? (
                      <>
                        <Square className="w-4 h-4" />
                        <span>End Break Now</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Start Rest Break (with Live GPS)</span>
                      </>
                    )}
                  </button>

                  {profile?.isBreakActive && (
                    <button
                      type="button"
                      onClick={handleSyncGps}
                      className="btn-secondary w-full py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <span>
                        {profile.lastLocation
                          ? `GPS Active (${profile.lastLocation.latitude.toFixed(4)}, ${profile.lastLocation.longitude.toFixed(4)}) · Refresh`
                          : 'Sync Live GPS Location'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-main-text">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Recent Personal Breaks</span>
                  </span>
                  <span className="font-mono text-main-text-muted tabular-nums">
                    Last {myBreaks.length}
                  </span>
                </div>

                {myBreaks.length === 0 ? (
                  <div className="p-4 rounded-xl bg-surface-1 border border-main-border text-xs text-main-text-muted text-center">
                    No recent breaks recorded.
                  </div>
                ) : (
                  <div className="divide-y divide-main-border border border-main-border rounded-xl bg-surface-1 overflow-hidden">
                    {myBreaks.map((b) => (
                      <div
                        key={b.id}
                        className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-mono tabular-nums text-main-text">
                          {safeFormat(b.startTime, 'MMM d, HH:mm')}
                        </span>
                        <span className="font-mono tabular-nums text-main-text-muted">
                          {b.duration !== undefined
                            ? `${b.duration} min`
                            : 'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. QUICK ASSIGN SHIFT DRAWER (ADMIN) */}
          {activeDrawer === 'assign-shift' && isAdmin && (
            <form onSubmit={handleAssignShift} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-main-text mb-1.5">
                  Team Member
                </label>
                <select
                  required
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select member...</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName || u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-main-text mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    className="input-field font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-main-text mb-1.5">
                    Shift Type
                  </label>
                  <select
                    value={assignType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssignType(val);
                      if (val === '1st Shift' || val === 'Morning') {
                        setAssignStart('06:00');
                        setAssignEnd('14:00');
                      } else if (val === '2nd Shift' || val === 'Afternoon') {
                        setAssignStart('14:00');
                        setAssignEnd('22:00');
                      } else if (val === '3rd Shift' || val === 'Night') {
                        setAssignStart('22:00');
                        setAssignEnd('06:00');
                      } else if (val === 'General') {
                        setAssignStart('09:00');
                        setAssignEnd('18:00');
                      } else if (val === 'WO') {
                        setAssignStart('00:00');
                        setAssignEnd('00:00');
                      } else if (val === 'CO') {
                        setAssignStart('09:00');
                        setAssignEnd('17:00');
                      }
                    }}
                    className="input-field"
                  >
                    <option value="1st Shift">1st Shift (06:00–14:00)</option>
                    <option value="2nd Shift">2nd Shift (14:00–22:00)</option>
                    <option value="3rd Shift">3rd Shift (22:00–06:00)</option>
                    <option value="General">General (09:00–18:00)</option>
                    <option value="WO">WO (Week Off)</option>
                    <option value="CO">CO (Comp Off)</option>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-main-text mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={assignStart}
                    onChange={(e) => setAssignStart(e.target.value)}
                    className="input-field font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-main-text mb-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={assignEnd}
                    onChange={(e) => setAssignEnd(e.target.value)}
                    className="input-field font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-main-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignBusy || !assignUserId}
                  className="btn-primary flex items-center gap-1.5"
                >
                  {assignSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Shift Assigned</span>
                    </>
                  ) : assignBusy ? (
                    <span>Assigning...</span>
                  ) : (
                    <span>Assign Shift</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 5. PROFILE, TIMEZONE & DUAL-THEME SETTINGS DRAWER */}
          {activeDrawer === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-main-text mb-1.5">
                  Full Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-main-text-muted absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your full name"
                    className="input-field pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-main-text mb-1.5">
                  Employee Badge / ID
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-104"
                  className="input-field font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-main-text mb-1.5">
                  Local Workspace Timezone
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-main-text-muted absolute left-3 top-3" />
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="input-field pl-9 font-mono text-xs"
                  >
                    {allTimezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-main-text-muted mt-1.5">
                  All shift schedules and break timestamps automatically convert
                  to this timezone.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-main-text mb-2">
                  2026 Surface Theme
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {availableThemes.map((opt) => {
                    const isSelected = theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTheme(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-primary bg-primary-subtle'
                            : 'border-main-border bg-surface-1 hover:border-main-border-strong'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-main-text flex items-center gap-1.5">
                            {opt.mode === 'dark' ? (
                              <Moon className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Sun className="w-3.5 h-3.5 text-primary" />
                            )}
                            <span>{opt.name}</span>
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-primary" />
                          )}
                        </div>
                        <p className="text-[11px] text-main-text-muted leading-snug">
                          {opt.mode === 'dark'
                            ? 'Warm Obsidian studio dark'
                            : 'Daylight Ivory warm light'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-main-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="btn-primary flex items-center gap-1.5"
                >
                  {settingsSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Saved</span>
                    </>
                  ) : savingSettings ? (
                    <span>Saving...</span>
                  ) : (
                    <span>Save Preferences</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
