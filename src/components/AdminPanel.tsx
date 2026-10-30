import { useDraftString } from '../hooks/useDraftString';
import { useChangeReview } from '../hooks/useChangeReview';
import { ChangeReview } from './ui/ChangeReview';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useTimezone } from '../TimezoneContext';
import {
  Shift,
  UserProfile,
  LeaveRequest,
  ShiftSwapRequest,
  Announcement,
  GlobalSettings,
  ShiftTemplate,
  AuditLog,
} from '../types';
import {
  generateWeeklyRoster,
  resolveRosterConflicts,
  extractRosterFromFile,
  SuggestedRosterShift,
  RosterConflictFix,
  ExtractedShift,
} from '../geminiService';
import * as XLSX from 'xlsx';
import {
  CalendarPlus,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  Settings,
  Trash2,
  Check,
  X,
  Plus,
  ShieldCheck,
  History,
  BookmarkPlus,
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, addDays } from 'date-fns';
import { safeFormat } from '../utils/dateUtils';

export type AdminTab = 'planner' | 'approvals' | 'team' | 'settings';

interface AdminPanelProps {
  subTab?: AdminTab;
  onSelectSubTab?: (tab: AdminTab) => void;
}

export default function AdminPanel({ subTab = 'planner' }: AdminPanelProps) {
  const { user, profile, isAdmin } = useAuth();
  const changeReview = useChangeReview();
  const committedRows = useRef(new WeakSet<object>());
  const handleFirestoreError = changeReview.reportError;
  const { userTimezone, convertToAppTime } = useTimezone();

  const [activeTab, setActiveTab] = useState<AdminTab>(subTab);

  useEffect(() => {
    setActiveTab(subTab);
  }, [subTab]);

  // Focused Sub-Mode Switchers (One Tool Per View)
  const [plannerMode, setPlannerMode] = useState<
    'manual' | 'autoschedule' | 'import'
  >('manual');
  const [approvalsMode, setApprovalsMode] = useState<'leaves' | 'swaps'>(
    'leaves'
  );
  const [settingsMode, setSettingsMode] = useState<
    'announcements' | 'defaults' | 'audit'
  >('announcements');

  // Modals / Popovers
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);

  // Firestore Collections
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    maxBreakDurationMinutes: 30,
    defaultHourlyRate: 25,
    defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  // Manual Shift Assignment State
  const [selectedUserId, setSelectedUserId] = useDraftString('AdminPanel-selectedUserId', '');
  const [shiftDate, setShiftDate] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [shiftStart, setShiftStart] = useDraftString('AdminPanel-shiftStart', '09:00');
  const [shiftEnd, setShiftEnd] = useDraftString('AdminPanel-shiftEnd', '17:00');
  const [shiftType, setShiftType] = useDraftString('AdminPanel-shiftType', 'Morning');
  const [savingShift, setSavingShift] = useState(false);
  const [shiftSavedSuccess, setShiftSavedSuccess] = useState(false);

  // Template Creator State
  const [tplName, setTplName] = useDraftString('AdminPanel-tplName', '');

  // Auto-Scheduler & Conflict State
  const [autoWeekStart, setAutoWeekStart] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [autoNotes, setAutoNotes] = useState(
    'Ensure balanced Morning, Afternoon, and Night coverage.'
  );
  const [suggestedRoster, setSuggestedRoster] = useState<
    SuggestedRosterShift[]
  >([]);
  const [generatingRoster, setGeneratingRoster] = useState(false);
  const [applyingRoster, setApplyingRoster] = useState(false);

  const [conflictFixes, setConflictFixes] = useState<RosterConflictFix[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // CSV / Excel Import State
  const [extractedShifts, setExtractedShifts] = useState<ExtractedShift[]>([]);
  const [importingFile, setImportingFile] = useState(false);

  // Team Member Add Modal Form
  const [newMemberName, setNewMemberName] = useDraftString('AdminPanel-newMemberName', '');
  const [newMemberEmail, setNewMemberEmail] = useDraftString('AdminPanel-newMemberEmail', '');
  const [newMemberEmpId, setNewMemberEmpId] = useDraftString('AdminPanel-newMemberEmpId', '');
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'admin'>(
    'member'
  );
  const [addingMember, setAddingMember] = useState(false);

  // Announcement Form
  const [announcementText, setAnnouncementText] = useDraftString('AdminPanel-announcementText', '');
  const [announcementPriority, setAnnouncementPriority] = useState<
    'low' | 'high' | 'urgent'
  >('low');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Settings Save Feedback
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const unsubShifts = onSnapshot(
      collection(db, 'shifts'),
      (snap) =>
        setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'shifts')
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ uid: d.id, ...d.data() } as UserProfile)
        );
        setUsers(list);
        if (list.length > 0 && !selectedUserId) {
          setSelectedUserId(list[0].uid);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubLeaves = onSnapshot(
      collection(db, 'leaveRequests'),
      (snap) =>
        setLeaves(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as LeaveRequest))
            .sort((a, b) => b.createdAt - a.createdAt)
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'leaveRequests')
    );

    const unsubSwaps = onSnapshot(
      collection(db, 'shiftSwaps'),
      (snap) =>
        setSwaps(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as ShiftSwapRequest))
            .sort((a, b) => b.createdAt - a.createdAt)
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'shiftSwaps')
    );

    const unsubAnnouncements = onSnapshot(
      query(
        collection(db, 'announcements'),
        orderBy('createdAt', 'desc'),
        limit(20)
      ),
      (snap) =>
        setAnnouncements(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
    );

    const unsubTemplates = onSnapshot(
      collection(db, 'shiftTemplates'),
      (snap) =>
        setTemplates(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShiftTemplate))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'shiftTemplates')
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

    const unsubAudit = onSnapshot(
      query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(30)
      ),
      (snap) =>
        setAuditLogs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    return () => {
      unsubShifts();
      unsubUsers();
      unsubLeaves();
      unsubSwaps();
      unsubAnnouncements();
      unsubTemplates();
      unsubSettings();
      unsubAudit();
    };
  }, [user, isAdmin]);

  const logAdminAction = async (
    action: string,
    targetId: string,
    targetName: string,
    details?: string
  ) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'auditLogs'), {
        adminId: user.uid,
        adminName: profile?.displayName || user.displayName || 'Manager',
        action,
        targetId,
        targetName,
        timestamp: Date.now(),
        details: details || '',
      });
    } catch {
      // Non-blocking audit log
    }
  };

  // --- Planner Actions ---
  const handleCreateShift = async (e?: React.FormEvent, confirmed = false) => {
    e?.preventDefault();
    if (!selectedUserId || savingShift) return;
    if (!confirmed) { changeReview.request([`Assign shift to ${users.find((person) => person.uid === selectedUserId)?.displayName ?? selectedUserId}`, `${shiftDate} - ${shiftStart} to ${shiftEnd}`, `Shift: ${shiftType}`], () => handleCreateShift(undefined, true)); return; }
    setSavingShift(true);
    try {
      const targetUser = users.find((u) => u.uid === selectedUserId);
      const appStart = convertToAppTime(shiftDate, shiftStart);
      const appEnd = convertToAppTime(shiftDate, shiftEnd);

      const docRef = await addDoc(collection(db, 'shifts'), {
        userId: selectedUserId,
        userName:
          targetUser?.displayName || targetUser?.email || 'Team Member',
        date: appStart.date,
        startTime: appStart.time,
        endTime: appEnd.time,
        type: shiftType,
        updatedAt: Date.now(),
      });

      await logAdminAction(
        'Assigned Shift',
        docRef.id,
        targetUser?.displayName || 'Member',
        `${shiftDate} (${shiftStart}-${shiftEnd})`
      );
      setShiftSavedSuccess(true);
      setTimeout(() => setShiftSavedSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    } finally {
      setSavingShift(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) return;
    try {
      await addDoc(collection(db, 'shiftTemplates'), {
        name: tplName.trim(),
        startTime: shiftStart,
        endTime: shiftEnd,
        type: shiftType,
      });
      setTplName('');
      setShowSavePresetModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shiftTemplates');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'shiftTemplates', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shiftTemplates/${id}`);
    }
  };

  const handleRunAutoScheduler = async () => {
    if (users.length === 0 || generatingRoster) return;
    setGeneratingRoster(true);
    try {
      const endDateStr = format(
        addDays(new Date(autoWeekStart), 6),
        'yyyy-MM-dd'
      );
      const suggestions = await generateWeeklyRoster(
        users,
        leaves,
        autoWeekStart,
        endDateStr,
        autoNotes
      );
      setSuggestedRoster(suggestions);
    } catch (error) {
      handleFirestoreError(error);
    } finally {
      setGeneratingRoster(false);
    }
  };

  const handleCommitSuggestedRoster = async (confirmed = false) => {
    if (suggestedRoster.length === 0 || applyingRoster) return;
    if (!confirmed) { changeReview.request([`Add ${suggestedRoster.length} suggested assignments. Existing shifts stay in place.`, ...suggestedRoster.map((entry) => `${entry.userName}: ${entry.date} ${entry.startTime}-${entry.endTime}`), 'Check availability, time off, and scheduling rules before applying AI suggestions.'], () => handleCommitSuggestedRoster(true)); return; }
    setApplyingRoster(true);
    try {
      for (const s of suggestedRoster) {
        if (committedRows.current.has(s)) continue;
        await addDoc(collection(db, 'shifts'), {
          userId: s.userId,
          userName: s.userName,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          type: s.type,
          updatedAt: Date.now(),
        });
        committedRows.current.add(s);
      }
      await logAdminAction(
        'Auto-Scheduled Week',
        autoWeekStart,
        `${suggestedRoster.length} shifts`,
        'Generated via Smart Auto-Planner'
      );
      setSuggestedRoster([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    } finally {
      setApplyingRoster(false);
    }
  };

  const handleCheckConflicts = async () => {
    setCheckingConflicts(true);
    try {
      const fixes = await resolveRosterConflicts(shifts, leaves, users);
      setConflictFixes(fixes);
    } catch (error) {
      handleFirestoreError(error);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleApplyConflictFix = async (fix: RosterConflictFix, confirmed = false) => {
    if (!confirmed) { const current = shifts.find((entry) => entry.id === fix.shiftId); changeReview.request([`Affected shift: ${current?.userName ?? fix.shiftId} - ${current?.date}`, `Suggested action: ${fix.suggestedAction}`, `Proposed time: ${fix.newDate ?? current?.date} ${fix.newStartTime ?? current?.startTime}-${fix.newEndTime ?? current?.endTime}`, 'This is a suggestion. Check the current records before saving.'], () => handleApplyConflictFix(fix, true)); return; }
    try {
      if (fix.suggestedAction.toLowerCase().includes('delete')) {
        await deleteDoc(doc(db, 'shifts', fix.shiftId));
      } else {
        await updateDoc(doc(db, 'shifts', fix.shiftId), {
          date: fix.newDate,
          startTime: fix.newStartTime,
          endTime: fix.newEndTime,
          updatedAt: Date.now(),
        });
      }
      setConflictFixes((prev) =>
        prev.filter((f) => f.shiftId !== fix.shiftId)
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${fix.shiftId}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingFile(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvText = XLSX.utils.sheet_to_csv(firstSheet);
      const parsed = await extractRosterFromFile(
        csvText,
        'text/csv',
        users,
        true
      );
      setExtractedShifts(parsed);
    } catch (error) {
      handleFirestoreError(error);
    } finally {
      setImportingFile(false);
      e.target.value = '';
    }
  };

  const handleCommitExtractedShifts = async (confirmed = false) => {
    if (extractedShifts.length === 0 || importingFile) return;
    const unmatched = extractedShifts.some((item) => !users.some((person) => person.uid === item.userId || person.displayName.toLowerCase() === item.userName.toLowerCase()));
    if (unmatched) { handleFirestoreError(new Error('Unmatched member')); return; }
    if (!confirmed) { changeReview.request([`Import ${extractedShifts.length} assignments. Existing shifts stay in place.`, ...extractedShifts.map((entry) => `${entry.userName}: ${entry.date} ${entry.startTime}-${entry.endTime}`)], () => handleCommitExtractedShifts(true)); return; }
    setImportingFile(true);
    try {
      for (const item of extractedShifts) {
        if (committedRows.current.has(item)) continue;
        const matchedUser =
          users.find((u) => u.uid === item.userId) ||
          users.find(
            (u) =>
              (u.displayName || '').toLowerCase() ===
              item.userName.toLowerCase()
          );

        if (matchedUser) {
          await addDoc(collection(db, 'shifts'), {
            userId: matchedUser.uid,
            userName: matchedUser.displayName || item.userName,
            date: item.date,
            startTime: item.startTime,
            endTime: item.endTime,
            type: item.type || 'Morning',
            updatedAt: Date.now(),
          });
          committedRows.current.add(item);
        }
      }
      setExtractedShifts([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    } finally {
      setImportingFile(false);
    }
  };

  // --- Approvals Actions ---
  const pendingLeaves = useMemo(
    () => leaves.filter((l) => l.status === 'pending'),
    [leaves]
  );
  const pendingSwaps = useMemo(
    () =>
      swaps.filter((s) => s.status === 'pending' || s.status === 'accepted'),
    [swaps]
  );

  const handleLeaveDecision = async (
    leave: LeaveRequest,
    status: 'approved' | 'rejected',
    confirmed = false
  ) => {
    if (!confirmed) { changeReview.request([`${status === 'approved' ? 'Approve' : 'Decline'} time off for ${leave.userName}`, `${leave.startDate} to ${leave.endDate}`, 'Existing shift assignments stay in place.'], () => handleLeaveDecision(leave, status, true), status === 'approved'); return; }
    try {
      await updateDoc(doc(db, 'leaveRequests', leave.id), { status });
      await logAdminAction(
        `Leave ${status}`,
        leave.id,
        leave.userName,
        `${leave.startDate} to ${leave.endDate}`
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `leaveRequests/${leave.id}`
      );
    }
  };

  const handleSwapDecision = async (
    swap: ShiftSwapRequest,
    status: 'approved' | 'rejected',
    confirmed = false
  ) => {
    if (!confirmed) { changeReview.request([`${status === 'approved' ? 'Approve' : 'Decline'} swap for ${swap.requesterName}`, `${swap.shiftDate} - ${swap.shiftTime}`, `Replacement: ${users.find((person) => person.uid === swap.targetUserId)?.displayName ?? 'Not selected'}`], () => handleSwapDecision(swap, status, true), status === 'approved'); return; }
    try {
      await updateDoc(doc(db, 'shiftSwaps', swap.id), { status });
      if (status === 'approved' && swap.targetUserId && swap.shiftId) {
        const target = users.find((u) => u.uid === swap.targetUserId);
        if (target) {
          await updateDoc(doc(db, 'shifts', swap.shiftId), {
            userId: target.uid,
            userName: target.displayName || target.email,
            updatedAt: Date.now(),
          });
        }
      }
      await logAdminAction(`Swap ${status}`, swap.id, swap.requesterName);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shiftSwaps/${swap.id}`);
    }
  };

  // --- Team & Payroll Actions ---
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !newMemberName.trim() || addingMember) return;
    setAddingMember(true);
    try {
      const slugId = `invite_${Date.now()}`;
      await setDoc(doc(db, 'users', slugId), {
        uid: slugId,
        email: newMemberEmail.trim().toLowerCase(),
        displayName: newMemberName.trim(),
        employeeId: newMemberEmpId.trim() || null,
        role: newMemberRole,
        createdAt: Date.now(),
      });
      await logAdminAction(
        'Added Team Member',
        slugId,
        newMemberName.trim(),
        newMemberEmail.trim()
      );
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberEmpId('');
      setShowAddMemberModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'users');
    } finally {
      setAddingMember(false);
    }
  };

  const handleToggleRole = async (member: UserProfile) => {
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    try {
      await updateDoc(doc(db, 'users', member.uid), { role: nextRole });
      if (nextRole === 'admin') {
        await setDoc(doc(db, 'admins', member.uid), { email: member.email });
      } else {
        await deleteDoc(doc(db, 'admins', member.uid));
      }
      await logAdminAction(
        'Updated Role',
        member.uid,
        member.displayName,
        `New role: ${nextRole}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${member.uid}`);
    }
  };

  const handleRemoveMember = async (member: UserProfile) => {
    if (member.uid === user?.uid) return;
    try {
      await deleteDoc(doc(db, 'users', member.uid));
      await logAdminAction('Removed Member', member.uid, member.displayName);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${member.uid}`);
    }
  };

  const payrollSummary = useMemo(() => {
    const rate = settings.defaultHourlyRate || 25;
    return users.map((u) => {
      const memberShifts = shifts.filter((s) => s.userId === u.uid);
      const totalHours = memberShifts.length * 8;
      return {
        uid: u.uid,
        name: u.displayName || u.email,
        role: u.role,
        employeeId: u.employeeId,
        shiftsCount: memberShifts.length,
        totalHours,
        estimatedPay: totalHours * rate,
      };
    });
  }, [users, shifts, settings.defaultHourlyRate]);

  // --- Announcements & Settings Actions ---
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !announcementText.trim() || postingAnnouncement) return;
    setPostingAnnouncement(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        content: announcementText.trim(),
        priority: announcementPriority,
        authorId: user.uid,
        authorName: profile?.displayName || user.displayName || 'Manager',
        createdAt: Date.now(),
      });
      setAnnouncementText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'announcements');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), settings, { merge: true });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    } finally {
      setSavingSettings(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-12 rounded-xl bg-surface-2 border border-main-border text-center">
        <ShieldCheck className="w-8 h-8 text-main-text-disabled mx-auto mb-2" />
        <h2 className="text-base font-semibold text-main-text">
          Manager Access Required
        </h2>
        <p className="text-xs text-main-text-muted mt-1">
          Only workspace administrators can modify team schedules, approve
          leave, and manage payroll settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <ChangeReview state={changeReview} />
      {/* =====================================================================
          TAB 1: SCHEDULE PLANNER (One Clean Tool at a Time)
         ===================================================================== */}
      {activeTab === 'planner' && (
        <div className="max-w-3xl space-y-5">
          {/* Sub-Tool Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-main-border pb-3">
            <div className="inline-flex items-center p-1 rounded-xl bg-surface-2 border border-main-border">
              {(
                [
                  { id: 'manual', label: 'Assign Shift', icon: CalendarPlus },
                  {
                    id: 'autoschedule',
                    label: 'Smart Auto-Schedule',
                    icon: Sparkles,
                  },
                  {
                    id: 'import',
                    label: 'Import Spreadsheet',
                    icon: Upload,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isActive = plannerMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPlannerMode(item.id)}
                    className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-primary-text'
                        : 'text-main-text-muted hover:text-main-text'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="admin-planner-pill"
                        transition={{
                          type: 'spring',
                          stiffness: 460,
                          damping: 32,
                        }}
                        className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-primary-active shadow-xs"
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TOOL 1: ASSIGN INDIVIDUAL SHIFT */}
          {plannerMode === 'manual' && (
            <div className="p-6 rounded-xl bg-surface-2 border border-main-border space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-main-text">
                    Assign Individual Shift
                  </h2>
                  <p className="text-xs text-main-text-muted mt-0.5">
                    Times are entered in your timezone ({userTimezone}) and
                    synced automatically.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(true)}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-primary" />
                  <span>Save Times as Preset</span>
                </button>
              </div>

              {shiftSavedSuccess && (
                <div className="p-3 rounded-lg bg-success/15 border border-success/30 text-xs text-success flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Shift assigned and synced to the team roster.</span>
                </div>
              )}

              {templates.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-main-text-muted mr-1">
                    Quick Presets:
                  </span>
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-1 border border-main-border text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShiftStart(tpl.startTime);
                          setShiftEnd(tpl.endTime);
                          setShiftType(tpl.type);
                        }}
                        className="text-main-text hover:text-primary font-medium cursor-pointer"
                      >
                        {tpl.name} ({tpl.startTime}–{tpl.endTime})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="text-main-text-disabled hover:text-error ml-1 cursor-pointer"
                        title="Remove preset"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={(event) => { void handleCreateShift(event); }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="adminpanel-field-1" className="block text-xs font-medium text-main-text mb-1">
                      Team Member
                    </label>
                    <select id="adminpanel-field-1"
                      required
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
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
                  <div>
                    <label htmlFor="adminpanel-field-2" className="block text-xs font-medium text-main-text mb-1">
                      Shift Date
                    </label>
                    <input id="adminpanel-field-2"
                      type="date"
                      required
                      value={shiftDate}
                      onChange={(e) => setShiftDate(e.target.value)}
                      className="input-field font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="adminpanel-field-3" className="block text-xs font-medium text-main-text mb-1">
                      Shift Type
                    </label>
                    <select id="adminpanel-field-3"
                      value={shiftType}
                      onChange={(e) => setShiftType(e.target.value)}
                      className="input-field"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Night">Night</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="adminpanel-field-4" className="block text-xs font-medium text-main-text mb-1">
                      Start Time
                    </label>
                    <input id="adminpanel-field-4"
                      type="time"
                      required
                      value={shiftStart}
                      onChange={(e) => setShiftStart(e.target.value)}
                      className="input-field font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="adminpanel-field-5" className="block text-xs font-medium text-main-text mb-1">
                      End Time
                    </label>
                    <input id="adminpanel-field-5"
                      type="time"
                      required
                      value={shiftEnd}
                      onChange={(e) => setShiftEnd(e.target.value)}
                      className="input-field font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingShift || !selectedUserId}
                    className="btn-primary px-5 py-2.5 text-xs cursor-pointer"
                  >
                    {savingShift ? 'Saving...' : 'Review changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TOOL 2: SMART WEEKLY AUTO-SCHEDULER */}
          {plannerMode === 'autoschedule' && (
            <div className="p-6 rounded-xl bg-surface-2 border border-main-border space-y-5">
              <div>
                <h2 className="text-base font-semibold text-main-text flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Smart Weekly Auto-Scheduler</span>
                </h2>
                <p className="text-xs text-main-text-muted mt-0.5">
                  Automatically builds a balanced 7-day schedule while
                  respecting approved time off.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adminpanel-field-6" className="block text-xs font-medium text-main-text mb-1">
                    Week Starting Date
                  </label>
                  <input id="adminpanel-field-6"
                    type="date"
                    value={autoWeekStart}
                    onChange={(e) => setAutoWeekStart(e.target.value)}
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="adminpanel-field-7" className="block text-xs font-medium text-main-text mb-1">
                    Coverage Preference
                  </label>
                  <input id="adminpanel-field-7"
                    type="text"
                    value={autoNotes}
                    onChange={(e) => setAutoNotes(e.target.value)}
                    placeholder="e.g. Prioritize morning coverage"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={generatingRoster || users.length === 0}
                  onClick={handleRunAutoScheduler}
                  className="btn-primary flex items-center gap-2 text-xs py-2.5 px-4 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {generatingRoster
                      ? 'Building Schedule...'
                      : 'Generate 7-Day Draft'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={checkingConflicts}
                  onClick={handleCheckConflicts}
                  className="btn-secondary flex items-center gap-2 text-xs py-2.5 px-4 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  <span>
                    {checkingConflicts
                      ? 'Scanning...'
                      : 'Scan Existing Roster for Conflicts'}
                  </span>
                </button>
              </div>

              {suggestedRoster.length > 0 && (
                <div className="pt-4 border-t border-main-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-main-text">
                      Draft Ready: {suggestedRoster.length} shifts generated
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSuggestedRoster([])}
                        className="btn-ghost py-1 px-2.5 text-xs cursor-pointer"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        disabled={applyingRoster}
                        onClick={() => { void handleCommitSuggestedRoster(); }}
                        className="btn-primary py-1.5 px-3.5 text-xs cursor-pointer"
                      >
                        {applyingRoster
                          ? 'Publishing...'
                          : 'Publish All to Schedule'}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-main-border border border-main-border rounded-lg bg-surface-1">
                    {suggestedRoster.map((item, idx) => (
                      <div
                        key={`${item.userId}-${item.date}-${idx}`}
                        className="px-3.5 py-2.5 text-xs flex items-center justify-between"
                      >
                        <span className="font-medium text-main-text">
                          {item.userName} · {item.type}
                        </span>
                        <span className="font-mono tabular-nums text-main-text-muted">
                          {item.date} ({item.startTime}–{item.endTime})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {conflictFixes.length > 0 && (
                <div className="pt-4 border-t border-main-border space-y-2.5">
                  <p className="text-xs font-semibold text-warning">
                    {conflictFixes.length} Schedule Conflicts Detected
                  </p>
                  {conflictFixes.map((fix) => (
                    <div
                      key={fix.shiftId}
                      className="p-3.5 rounded-lg bg-surface-1 border border-main-border flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-medium text-main-text">
                          {fix.rationale}
                        </p>
                        <p className="text-main-text-muted font-mono tabular-nums mt-0.5">
                          Suggested: {fix.suggestedAction} → {fix.newDate} (
                          {fix.newStartTime}–{fix.newEndTime})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyConflictFix(fix)}
                        className="btn-primary py-1.5 px-3 text-xs shrink-0 cursor-pointer"
                      >
                        Apply Fix
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TOOL 3: IMPORT SCHEDULE FROM CSV / EXCEL */}
          {plannerMode === 'import' && (
            <div className="p-6 rounded-xl bg-surface-2 border border-main-border space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-main-text flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    <span>Import Schedule from CSV or Excel</span>
                  </h2>
                  <p className="text-xs text-main-text-muted mt-0.5">
                    Upload a spreadsheet with employee names, dates
                    (YYYY-MM-DD), and shift times.
                  </p>
                </div>

                <label className="btn-primary py-2 px-4 text-xs flex items-center gap-2 self-start sm:self-auto cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>
                    {importingFile ? 'Reading File...' : 'Choose CSV / XLSX'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {extractedShifts.length > 0 ? (
                <div className="space-y-3 pt-3 border-t border-main-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-main-text">
                      Parsed {extractedShifts.length} shifts from spreadsheet
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExtractedShifts([])}
                        className="btn-ghost py-1 px-2 text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        disabled={importingFile}
                        onClick={() => { void handleCommitExtractedShifts(); }}
                        className="btn-primary py-1.5 px-3.5 text-xs cursor-pointer"
                      >
                        Import {extractedShifts.length} Shifts
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto border border-main-border rounded-lg bg-surface-1 divide-y divide-main-border text-xs">
                    {extractedShifts.map((item, idx) => (
                      <div
                        key={idx}
                        className="px-3.5 py-2.5 flex items-center justify-between"
                      >
                        <span className="font-medium text-main-text">
                          {item.userName} · {item.type}
                        </span>
                        <span className="font-mono tabular-nums text-main-text-muted">
                          {item.date} · {item.startTime}–{item.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-surface-1 border border-dashed border-main-border text-center text-xs text-main-text-muted">
                  No file uploaded yet. Select a `.csv` or `.xlsx` file above to
                  preview shifts before importing.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: APPROVALS QUEUE (Focused Single Table with Mode Switcher)
         ===================================================================== */}
      {activeTab === 'approvals' && (
        <div className="max-w-4xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-main-border pb-3">
            <div className="inline-flex items-center p-1 rounded-lg bg-surface-2 border border-main-border">
              <button
                type="button"
                onClick={() => setApprovalsMode('leaves')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  approvalsMode === 'leaves'
                    ? 'bg-primary text-primary-text shadow-xs'
                    : 'text-main-text-muted hover:text-main-text'
                }`}
              >
                Time Off Requests ({pendingLeaves.length})
              </button>
              <button
                type="button"
                onClick={() => setApprovalsMode('swaps')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  approvalsMode === 'swaps'
                    ? 'bg-primary text-primary-text shadow-xs'
                    : 'text-main-text-muted hover:text-main-text'
                }`}
              >
                Shift Swap Requests ({pendingSwaps.length})
              </button>
            </div>
          </div>

          {approvalsMode === 'leaves' ? (
            <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-main-border">
                <h2 className="text-sm font-semibold text-main-text">
                  Pending Time Off Requests
                </h2>
              </div>

              {pendingLeaves.length === 0 ? (
                <div className="py-12 text-center text-xs text-main-text-muted">
                  All time off requests have been reviewed.
                </div>
              ) : (
                <div className="divide-y divide-main-border">
                  {pendingLeaves.map((leave) => (
                    <div
                      key={leave.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-3/40 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-main-text">
                          {leave.userName}
                        </p>
                        <p className="font-mono text-xs tabular-nums text-primary mt-0.5">
                          {leave.startDate} → {leave.endDate}
                        </p>
                        <p className="text-xs text-main-text-muted mt-1">
                          {leave.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleLeaveDecision(leave, 'approved')
                          }
                          className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleLeaveDecision(leave, 'rejected')
                          }
                          className="btn-secondary py-1.5 px-3 text-xs text-error flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-main-border">
                <h2 className="text-sm font-semibold text-main-text">
                  Pending Shift Swap Requests
                </h2>
              </div>

              {pendingSwaps.length === 0 ? (
                <div className="py-12 text-center text-xs text-main-text-muted">
                  No active shift swap requests right now.
                </div>
              ) : (
                <div className="divide-y divide-main-border">
                  {pendingSwaps.map((swap) => {
                    const claimer = users.find(
                      (u) => u.uid === swap.targetUserId
                    );
                    return (
                      <div
                        key={swap.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-3/40 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-main-text">
                            {swap.requesterName}
                            {claimer && (
                              <span className="text-primary">
                                {' '}
                                → {claimer.displayName}
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-main-text-muted mt-0.5">
                            {swap.shiftDate} · {swap.shiftTime}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleSwapDecision(swap, 'approved')
                            }
                            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleSwapDecision(swap, 'rejected')
                            }
                            className="btn-secondary py-1.5 px-3 text-xs text-error flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: TEAM DIRECTORY & PAYROLL (Clean Table + Add Member Modal)
         ===================================================================== */}
      {activeTab === 'team' && (
        <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-main-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-main-text">
                Team Roster & Payroll Estimate ({payrollSummary.length})
              </h2>
              <p className="text-xs text-main-text-muted">
                Calculated at ${settings.defaultHourlyRate}/hr base rate
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddMemberModal(true)}
              className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Team Member</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-main-border text-xs font-semibold text-main-text-muted bg-surface-1/60">
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Assigned Shifts</th>
                  <th className="py-3 px-4 text-right">Scheduled Hours</th>
                  <th className="py-3 px-4 text-right">Est. Payroll</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-main-border text-sm">
                {payrollSummary.map((row) => {
                  const rawUser = users.find((u) => u.uid === row.uid);
                  return (
                    <tr
                      key={row.uid}
                      className="hover:bg-surface-3/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-main-text">
                        {row.name}
                        {row.employeeId && (
                          <span className="font-mono text-xs text-main-text-muted ml-2">
                            · #{row.employeeId}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs capitalize text-main-text">
                        {row.role === 'admin' ? (
                          <span className="text-primary font-semibold">
                            Manager
                          </span>
                        ) : (
                          'Member'
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-right text-main-text">
                        {row.shiftsCount}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-right text-main-text">
                        {row.totalHours}h
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-right font-semibold text-main-text">
                        ${row.estimatedPay.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {rawUser && (
                          <div className="inline-flex items-center gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() => handleToggleRole(rawUser)}
                              className="text-primary hover:underline cursor-pointer"
                            >
                              {rawUser.role === 'admin'
                                ? 'Make Member'
                                : 'Make Manager'}
                            </button>
                            {rawUser.uid !== user?.uid && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(rawUser)}
                                className="text-main-text-muted hover:text-error cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: SETTINGS & AUDIT (One Clean Tool at a Time)
         ===================================================================== */}
      {activeTab === 'settings' && (
        <div className="max-w-3xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-main-border pb-3">
            <div className="inline-flex items-center p-1 rounded-xl bg-surface-2 border border-main-border">
              {(
                [
                  {
                    id: 'announcements',
                    label: 'Team Announcements',
                    icon: Megaphone,
                  },
                  {
                    id: 'defaults',
                    label: 'Shift & Payroll Defaults',
                    icon: Settings,
                  },
                  {
                    id: 'audit',
                    label: 'Activity Audit Log',
                    icon: History,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isActive = settingsMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSettingsMode(item.id)}
                    className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-primary-text'
                        : 'text-main-text-muted hover:text-main-text'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="admin-settings-pill"
                        transition={{
                          type: 'spring',
                          stiffness: 460,
                          damping: 32,
                        }}
                        className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-primary-active shadow-xs"
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {settingsMode === 'announcements' && (
            <div className="p-6 rounded-xl bg-surface-2 border border-main-border space-y-4">
              <div>
                <h2 className="text-base font-semibold text-main-text">
                  Team Announcements
                </h2>
                <p className="text-xs text-main-text-muted mt-0.5">
                  Post important notices that appear at the top of everyone’s
                  Overview page.
                </p>
              </div>

              <form onSubmit={handlePostAnnouncement} className="space-y-3">
                <textarea
                  required
                  rows={2}
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="Write a clear update for the team..."
                  className="input-field text-xs"
                />
                <div className="flex items-center justify-between">
                  <select
                    value={announcementPriority}
                    onChange={(e) =>
                      setAnnouncementPriority(
                        e.target.value as 'low' | 'high' | 'urgent'
                      )
                    }
                    className="bg-surface-1 border border-main-border rounded-lg px-3 py-1.5 text-xs text-main-text"
                  >
                    <option value="low">Standard Notice</option>
                    <option value="high">Important</option>
                    <option value="urgent">Urgent Notice</option>
                  </select>
                  <button
                    type="submit"
                    disabled={postingAnnouncement || !announcementText.trim()}
                    className="btn-primary py-2 px-4 text-xs cursor-pointer"
                  >
                    {postingAnnouncement ? 'Posting...' : 'Publish Notice'}
                  </button>
                </div>
              </form>

              {announcements.length > 0 && (
                <div className="divide-y divide-main-border pt-2 border-t border-main-border">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="py-3 flex items-start justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="text-main-text font-medium">
                          {ann.content}
                        </p>
                        <p className="text-main-text-muted font-mono tabular-nums mt-0.5">
                          {ann.authorName} · {ann.priority} ·{' '}
                          {safeFormat(ann.createdAt, 'MMM d, HH:mm')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="text-main-text-muted hover:text-error p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {settingsMode === 'defaults' && (
            <form
              onSubmit={handleSaveSettings}
              className="p-6 rounded-xl bg-surface-2 border border-main-border space-y-5"
            >
              <div>
                <h2 className="text-base font-semibold text-main-text">
                  Shift & Payroll Defaults
                </h2>
                <p className="text-xs text-main-text-muted mt-0.5">
                  Configure break allowances and base hourly rate for payroll
                  estimates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adminpanel-field-8" className="block text-xs font-medium text-main-text mb-1">
                    Max Break Allowance (Minutes)
                  </label>
                  <input id="adminpanel-field-8"
                    type="number"
                    min={5}
                    max={120}
                    value={settings.maxBreakDurationMinutes}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        maxBreakDurationMinutes:
                          Number(e.target.value) || 30,
                      }))
                    }
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="adminpanel-field-9" className="block text-xs font-medium text-main-text mb-1">
                    Default Hourly Rate ($)
                  </label>
                  <input id="adminpanel-field-9"
                    type="number"
                    min={1}
                    value={settings.defaultHourlyRate}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        defaultHourlyRate: Number(e.target.value) || 25,
                      }))
                    }
                    className="input-field font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="btn-primary py-2 px-4 text-xs cursor-pointer"
                >
                  {settingsSaved
                    ? 'Saved!'
                    : savingSettings
                    ? 'Saving...'
                    : 'Save Workspace Settings'}
                </button>
              </div>
            </form>
          )}

          {settingsMode === 'audit' && (
            <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-main-border">
                <h2 className="text-sm font-semibold text-main-text">
                  Recent Manager Activity Log
                </h2>
              </div>

              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-main-text-muted">
                  No recent administrative actions logged.
                </div>
              ) : (
                <div className="divide-y divide-main-border text-xs">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 flex items-center justify-between gap-2 hover:bg-surface-3/40"
                    >
                      <div>
                        <span className="font-semibold text-main-text">
                          {log.action}
                        </span>{' '}
                        <span className="text-main-text-muted">
                          · {log.targetName}
                          {log.details ? ` (${log.details})` : ''}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-main-text-muted shrink-0">
                        {safeFormat(log.timestamp, 'MMM d, HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL: SAVE SHIFT PRESET
         ===================================================================== */}
      {showSavePresetModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowSavePresetModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm bg-surface-2 border border-main-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-main-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-main-text">
                Save Shift Preset
              </h3>
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="p-1 rounded-lg text-main-text-muted hover:text-main-text cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTemplate} className="p-5 space-y-4">
              <p className="text-xs text-main-text-muted">
                Saving current shift window:{' '}
                <strong className="text-main-text font-mono">
                  {shiftType} ({shiftStart}–{shiftEnd})
                </strong>
              </p>
              <div>
                <label htmlFor="adminpanel-field-10" className="block text-xs font-medium text-main-text mb-1">
                  Preset Name
                </label>
                <input id="adminpanel-field-10"
                  type="text"
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g. Early Opener"
                  className="input-field text-xs py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(false)}
                  className="btn-secondary py-1.5 px-3 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!tplName.trim()}
                  className="btn-primary py-1.5 px-3.5 text-xs cursor-pointer"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ADD TEAM MEMBER
         ===================================================================== */}
      {showAddMemberModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowAddMemberModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-surface-2 border border-main-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-main-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-main-text">
                Add or Pre-Register Team Member
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="p-1 rounded-lg text-main-text-muted hover:text-main-text cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-5 space-y-3.5">
              <div>
                <label htmlFor="adminpanel-field-11" className="block text-xs font-medium text-main-text mb-1">
                  Full Name
                </label>
                <input id="adminpanel-field-11"
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="input-field text-xs py-2"
                />
              </div>

              <div>
                <label htmlFor="adminpanel-field-12" className="block text-xs font-medium text-main-text mb-1">
                  Email Address
                </label>
                <input id="adminpanel-field-12"
                  type="email"
                  required
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="input-field text-xs py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="adminpanel-field-13" className="block text-xs font-medium text-main-text mb-1">
                    Employee ID (Optional)
                  </label>
                  <input id="adminpanel-field-13"
                    type="text"
                    value={newMemberEmpId}
                    onChange={(e) => setNewMemberEmpId(e.target.value)}
                    placeholder="EMP-12"
                    className="input-field font-mono text-xs py-2"
                  />
                </div>

                <div>
                  <label htmlFor="adminpanel-field-14" className="block text-xs font-medium text-main-text mb-1">
                    Workspace Role
                  </label>
                  <select id="adminpanel-field-14"
                    value={newMemberRole}
                    onChange={(e) =>
                      setNewMemberRole(e.target.value as 'member' | 'admin')
                    }
                    className="input-field text-xs py-2"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Manager</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="btn-secondary py-2 px-3 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="btn-primary py-2 px-4 text-xs cursor-pointer"
                >
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
