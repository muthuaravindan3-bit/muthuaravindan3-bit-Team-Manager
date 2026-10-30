import { ScenePanel } from './scenes/ScenePanel';
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useModalFocus } from '../hooks/useModalFocus';
import { CoverComparison } from './CoverComparison';
import { Button, Dialog, Feedback } from './ui/WorkspaceUI';
import { useAuth } from '../AuthContext';
import { useTimezone } from '../TimezoneContext';
import { useTheme } from '../ThemeContext';
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
  const { theme, setTheme, followsSystem, setFollowSystem, availableThemes } = useTheme();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [myBreaks, setMyBreaks] = useState<BreakLog[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    maxBreakDurationMinutes: 30,
    defaultHourlyRate: 25,
  });

  const [feedback, setFeedback] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [review, setReview] = useState<{ lines: string[]; run: () => Promise<void> } | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const requestClose = () => { if (reviewBusy) return; if (isDirty) setConfirmClose(true); else onClose(); };
  const drawerRef = useModalFocus<HTMLDivElement>(Boolean(activeDrawer), requestClose);
  useEffect(() => { setFeedback(''); setSavedMessage(''); setReview(null); setConfirmClose(false); setIsDirty(false); setSwapSuccess(false); setLeaveSuccess(false); setAssignSuccess(false); setEditSaved(false); setSettingsSaved(false); }, [activeDrawer]);
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);
  const finishSave = () => { setReview(null); setIsDirty(false); setFeedback(''); setSavedMessage('Your changes are saved.'); };
  const confirmReview = async () => {
    if (!review || reviewBusy) return;
    setReviewBusy(true); setFeedback('');
    try { await review.run(); } finally { setReviewBusy(false); }
  };

  // Swap Form State
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [preferredTypes, setPreferredTypes] = useState<string[]>([
    'Morning',
    'Afternoon',
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
  const [assignStart, setAssignStart] = useState('09:00');
  const [assignEnd, setAssignEnd] = useState('17:00');
  const [assignType, setAssignType] = useState('Morning');
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

  // Incoming profile updates must not replace entered values.
  useEffect(() => {
    if (isDirty) return;
    if (profile || user) {
      setDisplayName(profile?.displayName || user?.displayName || '');
      setEmployeeId(profile?.employeeId || '');
      setTimezone(profile?.timezone || browserTz);
    }
  }, [profile, user, browserTz, activeDrawer]);

  // Populate details without replacing unfinished edits.
  useEffect(() => {
    if (isDirty) return;
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


  // Subscribe to required data when drawer is open
  useEffect(() => {
    if (!user || !activeDrawer) return;

    const unsubShifts = onSnapshot(
      collection(db, 'shifts'),
      (snap) => {
        setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift)));
      },
      () => setFeedback('Some records could not be loaded. Close and reopen this panel to try again.')
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
      () => setFeedback('Some records could not be loaded. Close and reopen this panel to try again.')
    );

    const unsubBreaks = onSnapshot(
      query(collection(db, 'breakLogs'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as BreakLog))
          .sort((a, b) => b.startTime - a.startTime);
        setMyBreaks(list.slice(0, 6));
      },
      () => setFeedback('Some records could not be loaded. Close and reopen this panel to try again.')
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as GlobalSettings);
        }
      },
      () => setFeedback('Some records could not be loaded. Close and reopen this panel to try again.')
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

  const handleCreateSwap = async (e?: React.FormEvent, confirmed = false) => {
    e?.preventDefault();
    if (!user || !selectedShiftId || swapSubmitting) return;
    const shift = myUpcomingShifts.find((s) => s.id === selectedShiftId);
    if (!shift) return;

    if (!confirmed) { setReview({ lines: [`Shift: ${shift.localDate} - ${shift.localTime}`, `Requested by: ${profile?.displayName ?? 'You'}`, `Preferred shifts: ${preferredTypes.join(', ')}`, 'Your current assignment stays in place until the swap is approved.'], run: () => handleCreateSwap(undefined, true) }); return; }
    setSwapSubmitting(true);
    try {
      await addDoc(collection(db, 'shiftSwaps'), {
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
      finishSave();
    } catch (err) {
      setFeedback('We could not save your changes. Your entries are still here. Check your connection and try again.');
    } finally {
      setSwapSubmitting(false);
    }
  };

  const handleCreateLeave = async (e?: React.FormEvent, confirmed = false) => {
    e?.preventDefault();
    if (!user || !leaveReason.trim() || leaveSubmitting) return;
    if (leaveEnd < leaveStart) { setFeedback('Choose an end date on or after the start date.'); return; }
    if (!confirmed) { setReview({ lines: [`Time off: ${leaveStart} to ${leaveEnd}`, `Reason: ${leaveReason.trim()}`, 'Your manager will review this request. It does not remove existing shifts.'], run: () => handleCreateLeave(undefined, true) }); return; }
    setLeaveSubmitting(true);
    try {
      await addDoc(collection(db, 'leaveRequests'), {
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Team Member',
        startDate: leaveStart,
        endDate: leaveEnd < leaveStart ? leaveStart : leaveEnd,
        reason: leaveReason.trim(),
        status: 'pending',
        createdAt: Date.now(),
      });

      setLeaveSuccess(true);
      finishSave();
    } catch (err) {
      setFeedback('We could not save your changes. Your entries are still here. Check your connection and try again.');
    } finally {
      setLeaveSubmitting(false);
    }
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
      }
    } catch (err) {
      setFeedback('We could not save your changes. Your entries are still here. Check your connection and try again.');
    } finally {
      setBreakBusy(false);
    }
  };

  const handleSyncGps = async () => {
    if (!user || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: Date.now(),
          };
          await updateDoc(doc(db, 'users', user.uid), {
            lastLocation: loc,
          });
          if (profile?.activeBreakLogId) {
            await updateDoc(doc(db, 'breakLogs', profile.activeBreakLogId), {
              path: arrayUnion(loc),
            });
          }
        } catch (err) {
          setFeedback('We could not save your changes. Your entries are still here. Check your connection and try again.');
        }
      },
      (err) => console.warn('GPS sync error:', err.message)
    );
  };

  const handleAssignShift = async (e?: React.FormEvent, confirmed = false) => {
    e?.preventDefault();
    if (!isAdmin || !assignUserId || assignBusy) return;
    if (!confirmed) { setReview({ lines: [`Assign to: ${users.find((entry) => entry.uid === assignUserId)?.displayName ?? assignUserId}`, `${assignDate} - ${assignStart} - ${assignEnd} - ${userTimezone}`, `Shift: ${assignType}`, 'This assignment will be saved to the shared schedule.'], run: () => handleAssignShift(undefined, true) }); return; }
    setAssignBusy(true);
    try {
      const targetUser = users.find((u) => u.uid === assignUserId);
      const appStart = convertToAppTime(assignDate, assignStart);
      const appEnd = convertToAppTime(assignDate, assignEnd);

      await addDoc(collection(db, 'shifts'), {
        userId: assignUserId,
        userName:
          targetUser?.displayName || targetUser?.email || 'Team Member',
        date: appStart.date,
        startTime: appStart.time,
        endTime: appEnd.time,
        type: assignType,
        updatedAt: Date.now(),
      });
      setAssignSuccess(true);
      finishSave();
    } catch (err) {
      setFeedback('We could not save your changes. Your entries are still here. Check your connection and try again.');
    } finally {
      setAssignBusy(false);
    }
  };

  const handleUpdateInspectedShift = async (e?: React.FormEvent, confirmed = false) => {
    e?.preventDefault();
    if (!isAdmin || !inspectedShift || editSaving) return;
    if (!confirmed) { setReview({ lines: [`Current assignment: ${inspectedShift.userName} - ${inspectedShift.date} - ${inspectedShift.startTime} - ${inspectedShift.endTime} (schedule timezone)`, `New assignment: ${users.find((entry) => entry.uid === editUserId)?.displayName ?? editUserId}`, `${editDate} - ${editStart} - ${editEnd} - ${userTimezone}`, `Shift: ${editType}`], run: () => handleUpdateInspectedShift(undefined, true) }); return; }
    setEditSaving(true);
    try {
      const targetUser = users.find((u) => u.uid === editUserId);
      const appStart = convertToAppTime(editDate, editStart);
      const appEnd = convertToAppTime(editDate, editEnd);

      await updateDoc(doc(db, 'shifts', inspectedShift.id), {
        userId: editUserId,
        userName:
          targetUser?.displayName ||
          targetUser?.email ||
          inspectedShift.userName,
        date: appStart.date,
        startTime: appStart.time,
        endTime: appEnd.time,
        type: editType,
        updatedAt: Date.now(),
      });
      setEditSaved(true);
      finishSave();
    } catch (err) {
      setFeedback('We could not save your changes. Your entries are still here. Check your connection and try again.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteInspectedShift = async () => {
    if (!isAdmin || !inspectedShift) return;
    try {
      await deleteDoc(doc(db, 'shifts', inspectedShift.id));
      onClose();
    } catch (err) {
      setFeedback('We could not save your changes. Your entries are still here. Check your connection and try again.');
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent, confirmed = false) => {
    e?.preventDefault();
    if (!user || savingSettings) return;
    if (!confirmed) { setReview({ lines: [`Name: ${displayName}`, `Employee ID: ${employeeId || 'Not set'}`, `Timezone: ${timezone}`], run: () => handleSaveSettings(undefined, true) }); return; }
    setSavingSettings(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim() || user.displayName || 'Team Member',
        employeeId: employeeId.trim() || null,
        timezone,
      });
      setSettingsSaved(true);
      finishSave();
    } catch (err) {
      setFeedback('We could not save your changes. Your entries are still here. Check your connection and try again.');
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
      onClick={requestClose}
      ref={drawerRef}
      data-focus-scope="modal"
      tabIndex={-1}
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
            onClick={requestClose}
            aria-label="Close panel"
            className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 p-6" onChangeCapture={() => { setIsDirty(true); setSavedMessage(''); }}>
          {feedback && !review && <Feedback message={feedback} />}
          {savedMessage && <><Feedback tone="success" message={savedMessage} /><ScenePanel compact kind="check" title="Changes saved" description="The action completed successfully." /><Button variant="secondary" onClick={onClose}>Done</Button></>}
          {review && <Dialog title="Review changes" description="Check the details before saving." onClose={() => { if (!reviewBusy) setReview(null); }}>
            <div className="space-y-3">{review.lines.map((line, index) => <p key={index}>{line}</p>)}</div>
            {feedback && <Feedback message={feedback} onRetry={() => { void confirmReview(); }} />}
            <div className="ui-actions"><Button variant="secondary" disabled={reviewBusy} onClick={() => setReview(null)}>Keep editing</Button><Button disabled={reviewBusy} onClick={() => { void confirmReview(); }}>{reviewBusy ? 'Saving-' : 'Save changes'}</Button></div>
          </Dialog>}
          {confirmClose && <Dialog title="Keep your changes?" description="Closing this panel will leave these changes unsaved." onClose={() => setConfirmClose(false)}><div className="ui-actions"><Button variant="secondary" onClick={() => { setConfirmClose(false); setIsDirty(false); onClose(); }}>Close without saving</Button><Button onClick={() => setConfirmClose(false)}>Keep editing</Button></div></Dialog>}
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
                      <ScenePanel compact kind="calendar" selectedId={inspectedShift.id} title="Selected shift" description={`${inspectedShift.userName} - ${startConv.date}, ${startConv.time} to ${endConv.time} (${userTimezone}).`} />
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

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-main-border">
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

                      {isAdmin && <CoverComparison shift={inspectedShift} shifts={shifts} users={users} onChoose={(id) => { setEditUserId(id); setIsDirty(true); setSavedMessage(''); document.getElementById('shift-edit-form')?.scrollIntoView({ block: 'center' }); }} />}
                      {/* Admin Inline Edit & Reassignment Section */}
                      {isAdmin && (
                        <form
                          id="shift-edit-form"
                          onSubmit={(event) => { void handleUpdateInspectedShift(event); }}
                          className="p-4 rounded-xl bg-surface-1 border border-main-border space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-main-text flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-primary" />
                              <span>Manager Controls · Edit or Reassign</span>
                            </span>
                          </div>

                          <div>
                            <label htmlFor="quickactiondrawer-field-1" className="block text-xs font-medium text-main-text mb-1">
                              Assigned Team Member
                            </label>
                            <select id="quickactiondrawer-field-1"
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

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label htmlFor="quickactiondrawer-field-2" className="block text-xs font-medium text-main-text mb-1">
                                Date
                              </label>
                              <input id="quickactiondrawer-field-2"
                                type="date"
                                required
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="input-field font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label htmlFor="quickactiondrawer-field-3" className="block text-xs font-medium text-main-text mb-1">
                                Shift Type
                              </label>
                              <select id="quickactiondrawer-field-3"
                                value={editType}
                                onChange={(e) => setEditType(e.target.value)}
                                className="input-field text-xs"
                              >
                                <option value="Morning">Morning</option>
                                <option value="Afternoon">Afternoon</option>
                                <option value="Night">Night</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label htmlFor="quickactiondrawer-field-4" className="block text-xs font-medium text-main-text mb-1">
                                Start Time
                              </label>
                              <input id="quickactiondrawer-field-4"
                                type="time"
                                required
                                value={editStart}
                                onChange={(e) => setEditStart(e.target.value)}
                                className="input-field font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label htmlFor="quickactiondrawer-field-5" className="block text-xs font-medium text-main-text mb-1">
                                End Time
                              </label>
                              <input id="quickactiondrawer-field-5"
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
                                <span>Review changes</span>
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
            <form onSubmit={(event) => { void handleCreateSwap(event); }} className="space-y-5">
              {myUpcomingShifts.length === 0 ? (
                <div className="p-4 rounded-xl bg-surface-1 border border-main-border text-xs text-main-text-muted leading-relaxed">
                  You have no upcoming shifts scheduled to trade right now. Once
                  a shift is assigned to you, you can offer it here.
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="quickactiondrawer-field-6" className="block text-xs font-medium text-main-text mb-1.5">
                      Select Your Shift to Trade
                    </label>
                    <select id="quickactiondrawer-field-6"
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
                    <div className="grid grid-cols-3 gap-2">
                      {['Morning', 'Afternoon', 'Night'].map((t) => {
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
                  onClick={requestClose}
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
            <form onSubmit={(event) => { void handleCreateLeave(event); }} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="quickactiondrawer-field-7" className="block text-xs font-medium text-main-text mb-1.5">
                    Start Date
                  </label>
                  <input id="quickactiondrawer-field-7"
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
                  <label htmlFor="quickactiondrawer-field-8" className="block text-xs font-medium text-main-text mb-1.5">
                    End Date
                  </label>
                  <input id="quickactiondrawer-field-8"
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
                <label htmlFor="quickactiondrawer-field-9" className="block text-xs font-medium text-main-text mb-1.5">
                  Reason or Note for Manager
                </label>
                <textarea id="quickactiondrawer-field-9"
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
                  onClick={requestClose}
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
                    <span>Review changes</span>
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
            <form onSubmit={(event) => { void handleAssignShift(event); }} className="space-y-4">
              <div>
                <label htmlFor="quickactiondrawer-field-10" className="block text-xs font-medium text-main-text mb-1.5">
                  Team Member
                </label>
                <select id="quickactiondrawer-field-10"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="quickactiondrawer-field-11" className="block text-xs font-medium text-main-text mb-1.5">
                    Date
                  </label>
                  <input id="quickactiondrawer-field-11"
                    type="date"
                    required
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    className="input-field font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="quickactiondrawer-field-12" className="block text-xs font-medium text-main-text mb-1.5">
                    Shift Type
                  </label>
                  <select id="quickactiondrawer-field-12"
                    value={assignType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssignType(val);
                      if (val === 'Morning') {
                        setAssignStart('08:00');
                        setAssignEnd('16:00');
                      } else if (val === 'Afternoon') {
                        setAssignStart('16:00');
                        setAssignEnd('00:00');
                      } else if (val === 'Night') {
                        setAssignStart('00:00');
                        setAssignEnd('08:00');
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="quickactiondrawer-field-13" className="block text-xs font-medium text-main-text mb-1.5">
                    Start Time
                  </label>
                  <input id="quickactiondrawer-field-13"
                    type="time"
                    required
                    value={assignStart}
                    onChange={(e) => setAssignStart(e.target.value)}
                    className="input-field font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="quickactiondrawer-field-14" className="block text-xs font-medium text-main-text mb-1.5">
                    End Time
                  </label>
                  <input id="quickactiondrawer-field-14"
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
                  onClick={requestClose}
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
                    <span>Review changes</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 5. PROFILE, TIMEZONE & DUAL-THEME SETTINGS DRAWER */}
          {activeDrawer === 'settings' && (
            <form onSubmit={(event) => { void handleSaveSettings(event); }} className="space-y-5">
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
                <label htmlFor="quickactiondrawer-field-15" className="block text-xs font-medium text-main-text mb-1.5">
                  Employee Badge / ID
                </label>
                <input id="quickactiondrawer-field-15"
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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-main-text">
                    Color mode
                  </label>
                  <button
                    type="button"
                    onClick={setFollowSystem}
                    aria-pressed={followsSystem}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                      followsSystem
                        ? 'border-primary bg-primary-subtle text-primary font-semibold'
                        : 'border-main-border bg-surface-1 text-main-text-muted hover:text-main-text'
                    }`}
                  >
                    Follow system
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {availableThemes.map((opt) => {
                    const isSelected = !followsSystem && theme === opt.id;
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
                          {opt.id === 'amoled'
                            ? 'True #000000 OLED canvas'
                            : opt.mode === 'dark'
                              ? 'Graphite studio dark'
                              : 'Porcelain warm daylight'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-main-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={requestClose}
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
                    <span>Review changes</span>
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
