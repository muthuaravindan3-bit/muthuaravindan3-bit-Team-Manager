import { useChangeReview } from '../hooks/useChangeReview';
import { ChangeReview } from './ui/ChangeReview';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useTimezone } from '../TimezoneContext';
import {
  Shift,
  ShiftSwapRequest,
  LeaveRequest,
  UserProfile,
} from '../types';
import { WorkspaceTab } from './Navigation';
import {
  Bell,
  Check,
  X,
  ArrowLeftRight,
  CalendarOff,
  Coffee,
  Calendar,
  CheckCheck,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { safeFormat } from '../utils/dateUtils';

interface NotificationCenterProps {
  onNavigateSubTab: (tab: WorkspaceTab, subTab: string) => void;
  onInspectShift?: (shift: Shift) => void;
}

export default function NotificationCenter({
  onNavigateSubTab,
  onInspectShift,
}: NotificationCenterProps) {
  const { user, isAdmin } = useAuth();
  const changeReview = useChangeReview();
  const handleFirestoreError = changeReview.reportError;
  const { convertToUserTime } = useTimezone();

  const [isOpen, setIsOpen] = useState(false);
  const [activeFeedTab, setActiveFeedTab] = useState<'action' | 'activity'>('action');
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('shiftsync_dismissed_notifs_v1');
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [];
    } catch {
      return [];
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const unsubSwaps = onSnapshot(
      query(collection(db, 'shiftSwaps'), orderBy('createdAt', 'desc')),
      (snap) => {
        setSwaps(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShiftSwapRequest))
        );
      },
      (err) => console.warn('Notice syncing shiftSwaps feed:', err)
    );

    const leavesQuery = isAdmin
      ? collection(db, 'leaveRequests')
      : query(
          collection(db, 'leaveRequests'),
          where('userId', '==', user.uid)
        );

    const unsubLeaves = onSnapshot(
      leavesQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as LeaveRequest))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setLeaves(list);
      },
      (err) => console.warn('Notice syncing leaveRequests feed:', err)
    );

    const unsubShifts = onSnapshot(
      collection(db, 'shifts'),
      (snap) => {
        setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift)));
      },
      (err) => console.warn('Notice syncing shifts feed:', err)
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(
          snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
        );
      },
      (err) => console.warn('Notice syncing users feed:', err)
    );

    return () => {
      unsubSwaps();
      unsubLeaves();
      unsubShifts();
      unsubUsers();
    };
  }, [user, isAdmin]);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const dismissNotification = (id: string) => {
    setDismissedIds((prev) => {
      const next = Array.from(new Set([...prev, id]));
      try {
        localStorage.setItem('shiftsync_dismissed_notifs_v1', JSON.stringify(next));
      } catch {
        // Ignore storage quota issues
      }
      return next;
    });
  };

  // 1-Click Peer Cover Shift
  const handlePeerCoverSwap = async (swap: ShiftSwapRequest, confirmed = false) => {
    if (!confirmed) { changeReview.request([`Offer to cover ${swap.requesterName}'s shift`, `${swap.shiftDate} - ${swap.shiftTime}`, 'An admin must approve the change.'], () => handlePeerCoverSwap(swap, true)); return; }
    if (!user || busyId) return;
    setBusyId(swap.id);
    try {
      await updateDoc(doc(db, 'shiftSwaps', swap.id), {
        status: 'accepted',
        targetUserId: user.uid,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shiftSwaps/${swap.id}`);
    } finally {
      setBusyId(null);
    }
  };

  // 1-Click Admin Swap Approval / Rejection
  const handleAdminSwapDecision = async (
    swap: ShiftSwapRequest,
    decision: 'approved' | 'rejected',
    confirmed = false
  ) => {
    if (!isAdmin || busyId) return;
    if (!confirmed) { changeReview.request([`${decision === 'approved' ? 'Approve' : 'Decline'} this request`, `${swap.requesterName}: ${swap.shiftDate} ${swap.shiftTime}`], () => handleAdminSwapDecision(swap, decision, true), decision === 'approved'); return; }
    setBusyId(swap.id);
    try {
      await updateDoc(doc(db, 'shiftSwaps', swap.id), {
        status: decision,
      });
      if (decision === 'approved' && swap.targetUserId && swap.shiftId) {
        const targetUser = users.find((u) => u.uid === swap.targetUserId);
        if (targetUser) {
          await updateDoc(doc(db, 'shifts', swap.shiftId), {
            userId: targetUser.uid,
            userName: targetUser.displayName || targetUser.email,
            updatedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shiftSwaps/${swap.id}`);
    } finally {
      setBusyId(null);
    }
  };

  // 1-Click Admin Leave Approval / Rejection
  const handleAdminLeaveDecision = async (
    leave: LeaveRequest,
    decision: 'approved' | 'rejected',
    confirmed = false
  ) => {
    if (!isAdmin || busyId) return;
    if (!confirmed) { changeReview.request([`${decision === 'approved' ? 'Approve' : 'Decline'} this request`, `${leave.userName}: ${leave.startDate} to ${leave.endDate}`], () => handleAdminLeaveDecision(leave, decision, true), decision === 'approved'); return; }
    setBusyId(leave.id);
    try {
      await updateDoc(doc(db, 'leaveRequests', leave.id), {
        status: decision,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `leaveRequests/${leave.id}`);
    } finally {
      setBusyId(null);
    }
  };

  // Action Required Items
  const peerOpenSwaps = useMemo(() => {
    if (!user) return [];
    return swaps.filter(
      (s) =>
        s.status === 'pending' &&
        s.requesterId !== user.uid &&
        !dismissedIds.includes(`peer-swap-${s.id}`)
    );
  }, [swaps, user, dismissedIds]);

  const adminPendingSwaps = useMemo(() => {
    if (!isAdmin) return [];
    return swaps.filter(
      (s) =>
        (s.status === 'pending' || s.status === 'accepted') &&
        !dismissedIds.includes(`admin-swap-${s.id}`)
    );
  }, [swaps, isAdmin, dismissedIds]);

  const adminPendingLeaves = useMemo(() => {
    if (!isAdmin) return [];
    return leaves.filter(
      (l) =>
        l.status === 'pending' && !dismissedIds.includes(`admin-leave-${l.id}`)
    );
  }, [leaves, isAdmin, dismissedIds]);

  const actionRequiredCount = isAdmin
    ? adminPendingSwaps.length + adminPendingLeaves.length
    : peerOpenSwaps.length;

  // Workspace Activity Items
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const myUpcomingShifts = useMemo(() => {
    if (!user) return [];
    return shifts
      .filter(
        (s) =>
          s.userId === user.uid &&
          s.date >= todayStr &&
          !dismissedIds.includes(`shift-${s.id}`)
      )
      .slice(0, 4);
  }, [shifts, user, todayStr, dismissedIds]);

  const activeBreakMembers = useMemo(() => {
    return users.filter(
      (u) => u.isBreakActive && !dismissedIds.includes(`break-${u.uid}`)
    );
  }, [users, dismissedIds]);

  const myRecentRequests = useMemo((): {
    mySwaps: ShiftSwapRequest[];
    myLeaves: LeaveRequest[];
  } => {
    if (!user) return { mySwaps: [], myLeaves: [] };
    const mySwaps = swaps
      .filter(
        (s) =>
          s.requesterId === user.uid &&
          !dismissedIds.includes(`my-swap-${s.id}`)
      )
      .slice(0, 3);
    const myLeaves = leaves
      .filter(
        (l) =>
          l.userId === user.uid && !dismissedIds.includes(`my-leave-${l.id}`)
      )
      .slice(0, 3);
    return { mySwaps, myLeaves };
  }, [swaps, leaves, user, dismissedIds]);

  const activityCount =
    myUpcomingShifts.length +
    activeBreakMembers.length +
    myRecentRequests.mySwaps.length +
    myRecentRequests.myLeaves.length;

  const totalBadgeCount = actionRequiredCount;

  const handleMarkAllRead = () => {
    const allIds: string[] = [
      ...peerOpenSwaps.map((s) => `peer-swap-${s.id}`),
      ...adminPendingSwaps.map((s) => `admin-swap-${s.id}`),
      ...adminPendingLeaves.map((l) => `admin-leave-${l.id}`),
      ...myUpcomingShifts.map((s) => `shift-${s.id}`),
      ...activeBreakMembers.map((u) => `break-${u.uid}`),
      ...myRecentRequests.mySwaps.map((s) => `my-swap-${s.id}`),
      ...myRecentRequests.myLeaves.map((l) => `my-leave-${l.id}`),
    ];
    setDismissedIds((prev) => {
      const next = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem('shiftsync_dismissed_notifs_v1', JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <ChangeReview state={changeReview} />
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Notifications and approvals"
        aria-label="Notifications and approvals"
        aria-expanded={isOpen}
        className={`btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1.5 relative ${
          isOpen ? 'border-primary text-primary bg-primary-subtle' : ''
        }`}
      >
        <Bell className="w-3.5 h-3.5 text-primary" />
        {totalBadgeCount > 0 && (
          <span className="font-mono text-[11px] tabular-nums font-bold text-primary">
            {totalBadgeCount}
          </span>
        )}
        {totalBadgeCount > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notification Center"
          className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-24px)] sm:w-96 max-h-[80vh] bg-surface-2 border border-main-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-main-border flex items-center justify-between bg-surface-1/60">
            <div>
              <h3 className="text-xs font-display font-bold text-main-text uppercase tracking-wider">
                Notification Center
              </h3>
              <p className="text-[11px] text-main-text-muted">
                Requests, shift updates, and review actions
              </p>
            </div>

            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Clear all</span>
            </button>
          </div>

          {/* Sub-Tabs inside Notification Center */}
          <div className="p-2 border-b border-main-border bg-surface-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFeedTab('action')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeFeedTab === 'action'
                  ? 'bg-primary-subtle text-primary border border-primary/30'
                  : 'text-main-text-muted hover:text-main-text hover:bg-surface-3'
              }`}
            >
              <span>Action Required</span>
              <span className="font-mono text-[11px] tabular-nums">
                ({actionRequiredCount})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFeedTab('activity')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeFeedTab === 'activity'
                  ? 'bg-primary-subtle text-primary border border-primary/30'
                  : 'text-main-text-muted hover:text-main-text hover:bg-surface-3'
              }`}
            >
              <span>Live Activity</span>
              <span className="font-mono text-[11px] tabular-nums">
                ({activityCount})
              </span>
            </button>
          </div>

          {/* Feed Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-main-border max-h-96">
            {activeFeedTab === 'action' ? (
              actionRequiredCount === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <Check className="w-7 h-7 text-success mx-auto" />
                  <p className="text-xs font-semibold text-main-text">
                    All caught up!
                  </p>
                  <p className="text-[11px] text-main-text-muted">
                    No pending shift swaps or leave approvals require your action right now.
                  </p>
                </div>
              ) : (
                <>
                  {/* Admin Pending Swaps */}
                  {isAdmin &&
                    adminPendingSwaps.map((swap) => (
                      <div
                        key={`admin-swap-${swap.id}`}
                        className="p-3.5 hover:bg-surface-3/40 transition-colors space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <ArrowLeftRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-main-text">
                                Swap Approval · {swap.requesterName}
                              </p>
                              <p className="text-[11px] text-main-text-muted font-mono tabular-nums mt-0.5">
                                {swap.shiftDate} · {swap.shiftTime} ({swap.status})
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              dismissNotification(`admin-swap-${swap.id}`)
                            }
                            className="text-main-text-disabled hover:text-main-text p-0.5 cursor-pointer"
                            aria-label="Dismiss notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busyId === swap.id}
                            onClick={() =>
                              handleAdminSwapDecision(swap, 'rejected')
                            }
                            className="btn-secondary py-1 px-2.5 text-[11px] text-error flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Decline</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === swap.id}
                            onClick={() =>
                              handleAdminSwapDecision(swap, 'approved')
                            }
                            className="btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Review approval</span>
                          </button>
                        </div>
                      </div>
                    ))}

                  {/* Admin Pending Leaves */}
                  {isAdmin &&
                    adminPendingLeaves.map((leave) => (
                      <div
                        key={`admin-leave-${leave.id}`}
                        className="p-3.5 hover:bg-surface-3/40 transition-colors space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <CalendarOff className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-main-text">
                                Leave Request · {leave.userName}
                              </p>
                              <p className="text-[11px] text-main-text-muted font-mono tabular-nums">
                                {leave.startDate} → {leave.endDate}
                              </p>
                              <p className="text-[11px] text-main-text mt-0.5 line-clamp-1">
                                “{leave.reason}”
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              dismissNotification(`admin-leave-${leave.id}`)
                            }
                            className="text-main-text-disabled hover:text-main-text p-0.5 cursor-pointer"
                            aria-label="Dismiss notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busyId === leave.id}
                            onClick={() =>
                              handleAdminLeaveDecision(leave, 'rejected')
                            }
                            className="btn-secondary py-1 px-2.5 text-[11px] text-error flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Decline</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === leave.id}
                            onClick={() =>
                              handleAdminLeaveDecision(leave, 'approved')
                            }
                            className="btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Review approval</span>
                          </button>
                        </div>
                      </div>
                    ))}

                  {/* Peer Open Swaps (for non-admins or teammates) */}
                  {!isAdmin &&
                    peerOpenSwaps.map((swap) => (
                      <div
                        key={`peer-swap-${swap.id}`}
                        className="p-3.5 hover:bg-surface-3/40 transition-colors space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <ArrowLeftRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-main-text">
                                {swap.requesterName} offered a shift
                              </p>
                              <p className="text-[11px] text-main-text-muted font-mono tabular-nums">
                                {swap.shiftDate} · {swap.shiftTime}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              dismissNotification(`peer-swap-${swap.id}`)
                            }
                            className="text-main-text-disabled hover:text-main-text p-0.5 cursor-pointer"
                            aria-label="Dismiss notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busyId === swap.id}
                            onClick={() => handlePeerCoverSwap(swap)}
                            className="btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>1-Click Cover Shift</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </>
              )
            ) : activityCount === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <Bell className="w-7 h-7 text-main-text-disabled mx-auto" />
                <p className="text-xs font-semibold text-main-text">
                  No recent activity
                </p>
                <p className="text-[11px] text-main-text-muted">
                  Upcoming shifts, active rest breaks, and request updates appear here.
                </p>
              </div>
            ) : (
              <>
                {/* Active Breaks */}
                {activeBreakMembers.map((member) => (
                  <div
                    key={`break-${member.uid}`}
                    className="p-3.5 hover:bg-surface-3/40 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Coffee className="w-4 h-4 text-warning shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-main-text truncate">
                          {member.displayName} is on rest break
                        </p>
                        <p className="text-[11px] text-main-text-muted font-mono tabular-nums">
                          {member.breakStartTime
                            ? `Started at ${safeFormat(member.breakStartTime, 'HH:mm')}`
                            : 'Active now'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onNavigateSubTab('operations', 'tracker');
                      }}
                      className="text-[11px] font-semibold text-primary hover:underline shrink-0 cursor-pointer"
                    >
                      Track Live
                    </button>
                  </div>
                ))}

                {/* My Upcoming Shifts */}
                {myUpcomingShifts.map((shift) => {
                  const startConv = convertToUserTime(
                    shift.date,
                    shift.startTime
                  );
                  const endConv = convertToUserTime(shift.date, shift.endTime);
                  return (
                    <div
                      key={`shift-${shift.id}`}
                      className="p-3.5 hover:bg-surface-3/40 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-main-text truncate">
                            Upcoming {shift.type} Shift
                          </p>
                          <p className="text-[11px] text-main-text-muted font-mono tabular-nums">
                            {startConv.date} · {startConv.time} – {endConv.time}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          if (onInspectShift) {
                            onInspectShift(shift);
                          } else {
                            onNavigateSubTab('schedule', 'mine');
                          }
                        }}
                        className="text-[11px] font-semibold text-primary hover:underline shrink-0 flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-main-border bg-surface-1/60 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigateSubTab('requests', 'swaps');
              }}
              className="font-semibold text-primary hover:underline cursor-pointer"
            >
              Open Swap Marketplace →
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigateSubTab('schedule', 'week');
              }}
              className="text-main-text-muted hover:text-main-text cursor-pointer"
            >
              Full Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
