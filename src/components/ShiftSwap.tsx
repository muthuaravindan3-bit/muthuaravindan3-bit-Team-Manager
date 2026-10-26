import { useChangeReview } from '../hooks/useChangeReview';
import { ChangeReview } from './ui/ChangeReview';
import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Shift, ShiftSwapRequest, UserProfile } from '../types';
import { getShiftSwapRecommendations } from '../geminiService';
import {
  ArrowLeftRight,
  Plus,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { QuickDrawerType } from './Navigation';

interface ShiftSwapProps {
  onOpenQuickDrawer?: (drawer: QuickDrawerType) => void;
  externalStatusFilter?: 'all' | 'pending' | 'accepted' | 'approved' | 'rejected';
  onChangeExternalStatusFilter?: (
    status: 'all' | 'pending' | 'accepted' | 'approved' | 'rejected'
  ) => void;
}

export default function ShiftSwap({
  onOpenQuickDrawer,
  externalStatusFilter,
  onChangeExternalStatusFilter,
}: ShiftSwapProps) {
  const { user, isAdmin } = useAuth();
  const changeReview = useChangeReview();
  const handleFirestoreError = changeReview.reportError;

  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalStatusFilter, setInternalStatusFilter] = useState<
    'all' | 'pending' | 'accepted' | 'approved' | 'rejected'
  >('all');

  const statusFilter = externalStatusFilter ?? internalStatusFilter;
  const setStatusFilter =
    onChangeExternalStatusFilter ?? setInternalStatusFilter;

  // Smart match recommendations
  const [recommendations, setRecommendations] = useState<
    Record<
      string,
      Array<{
        shiftId: string;
        userName: string;
        matchScore: number;
        reason: string;
      }>
    >
  >({});
  const [loadingRecsFor, setLoadingRecsFor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubSwaps = onSnapshot(
      query(collection(db, 'shiftSwaps'), orderBy('createdAt', 'desc')),
      (snap) => {
        setSwaps(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShiftSwapRequest))
        );
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'shiftSwaps')
    );

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
        setUsers(
          snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => {
      unsubSwaps();
      unsubShifts();
      unsubUsers();
    };
  }, [user]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const handleAcceptSwap = async (swap: ShiftSwapRequest, confirmed = false) => {
    if (!user) return;
    if (!confirmed) { changeReview.request([`Offer to cover ${swap.requesterName}'s shift`, `${swap.shiftDate} - ${swap.shiftTime}`, 'An admin must approve this swap before the assignment changes.'], () => handleAcceptSwap(swap, true)); return; }
    try {
      await updateDoc(doc(db, 'shiftSwaps', swap.id), {
        status: 'accepted',
        targetUserId: user.uid,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shiftSwaps/${swap.id}`);
    }
  };

  const handleCancelSwap = async (swapId: string, confirmed = false) => {
    if (!confirmed) { changeReview.request(['Cancel this swap request?', 'The current shift assignment will stay in place.'], () => handleCancelSwap(swapId, true)); return; }
    try {
      await updateDoc(doc(db, 'shiftSwaps', swapId), {
        status: 'cancelled',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shiftSwaps/${swapId}`);
    }
  };

  const handleAdminDecision = async (
    swap: ShiftSwapRequest,
    decision: 'approved' | 'rejected',
    confirmed = false
  ) => {
    if (!isAdmin) return;
    if (!confirmed) { changeReview.request([`${decision === 'approved' ? 'Approve' : 'Decline'} swap: ${swap.requesterName}`, `${swap.shiftDate} - ${swap.shiftTime}`, `Replacement: ${users.find((person) => person.uid === swap.targetUserId)?.displayName ?? 'Not selected'}`], () => handleAdminDecision(swap, decision, true)); return; }
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
    }
  };

  const handleFindMatches = async (swap: ShiftSwapRequest) => {
    setLoadingRecsFor(swap.id);
    try {
      const candidateShifts = shifts.filter(
        (s) => s.userId !== swap.requesterId && s.date >= todayStr
      );
      const recs = await getShiftSwapRecommendations(
        swap,
        candidateShifts,
        users
      );
      setRecommendations((prev) => ({ ...prev, [swap.id]: recs }));
    } finally {
      setLoadingRecsFor(null);
    }
  };

  const filteredSwaps = swaps.filter((s) =>
    statusFilter === 'all' ? true : s.status === statusFilter
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 rounded-xl bg-surface-2 border border-main-border animate-pulse" />
        <div className="h-48 rounded-xl bg-surface-2 border border-main-border animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ChangeReview state={changeReview} />
      {/* Action & Filter Bar */}
      <div className="p-4 rounded-xl bg-surface-2 border border-main-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            ['all', 'pending', 'accepted', 'approved', 'rejected'] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-primary-subtle text-primary border border-primary/30'
                  : 'bg-surface-1 text-main-text-muted border border-main-border hover:text-main-text'
              }`}
            >
              {st === 'all' ? `All Swaps (${swaps.length})` : st}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onOpenQuickDrawer?.('swap')}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Post Shift to Swap</span>
        </button>
      </div>

      {/* Swap List */}
      {filteredSwaps.length === 0 ? (
        <div className="p-12 rounded-xl bg-surface-2 border border-main-border text-center">
          <ArrowLeftRight className="w-8 h-8 text-main-text-disabled mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-main-text">
            No shift swap requests in this view
          </h3>
          <p className="text-xs text-main-text-muted mt-1 max-w-md mx-auto">
            Need a teammate to cover an upcoming shift? Click “Post Shift to Swap” to open the slide-over request drawer.
          </p>
          <button
            type="button"
            onClick={() => onOpenQuickDrawer?.('swap')}
            className="btn-primary mt-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Post Shift to Swap</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSwaps.map((swap) => {
            const isRequester = swap.requesterId === user?.uid;
            const targetUser = users.find((u) => u.uid === swap.targetUserId);
            const recs = recommendations[swap.id];

            return (
              <div
                key={swap.id}
                className="p-5 rounded-xl bg-surface-2 border border-main-border space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-main-text">
                      <span>{swap.requesterName}</span>
                      <span className="text-main-text-muted font-normal">·</span>
                      <span className="font-mono text-xs tabular-nums text-primary">
                        {swap.shiftDate} ({swap.shiftTime})
                      </span>
                    </div>
                    <p className="text-xs text-main-text-muted">
                      Status:{' '}
                      <span
                        className={`font-semibold capitalize ${
                          swap.status === 'approved'
                            ? 'text-success'
                            : swap.status === 'accepted'
                            ? 'text-primary'
                            : swap.status === 'rejected' ||
                              swap.status === 'cancelled'
                            ? 'text-error'
                            : 'text-main-text'
                        }`}
                      >
                        {swap.status}
                      </span>
                      {targetUser && (
                        <span>
                          {' '}
                          · Claimed by{' '}
                          <strong className="text-main-text">
                            {targetUser.displayName}
                          </strong>
                        </span>
                      )}
                      {swap.preferredTypes &&
                        swap.preferredTypes.length > 0 && (
                          <span>
                            {' '}
                            · Prefers: {swap.preferredTypes.join(', ')}
                          </span>
                        )}
                    </p>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {swap.status === 'pending' && (
                      <button
                        type="button"
                        disabled={loadingRecsFor === swap.id}
                        onClick={() => handleFindMatches(swap)}
                        className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>
                          {loadingRecsFor === swap.id
                            ? 'Checking roster...'
                            : 'Suggested Matches'}
                        </span>
                      </button>
                    )}

                    {swap.status === 'pending' && !isRequester && (
                      <button
                        type="button"
                        onClick={() => handleAcceptSwap(swap)}
                        className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Cover This Shift</span>
                      </button>
                    )}

                    {swap.status === 'pending' && isRequester && (
                      <button
                        type="button"
                        onClick={() => handleCancelSwap(swap.id)}
                        className="btn-secondary py-1.5 px-3 text-xs text-error hover:border-error"
                      >
                        Cancel Request
                      </button>
                    )}

                    {isAdmin &&
                      (swap.status === 'pending' ||
                        swap.status === 'accepted') && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdminDecision(swap, 'approved')
                            }
                            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdminDecision(swap, 'rejected')
                            }
                            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 text-error"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </>
                      )}
                  </div>
                </div>

                {/* Smart Recommendations Panel */}
                {recs && (
                  <div className="pt-3 border-t border-main-border">
                    <p className="text-xs font-semibold text-main-text mb-2">
                      Compatible Teammate Shifts
                    </p>
                    {recs.length === 0 ? (
                      <p className="text-xs text-main-text-muted">
                        No non-conflicting upcoming shifts found to trade with.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {recs.map((r) => (
                          <div
                            key={r.shiftId}
                            className="p-3 rounded-lg bg-surface-1 border border-main-border text-xs"
                          >
                            <div className="flex items-center justify-between font-semibold text-main-text">
                              <span>{r.userName}</span>
                              <span className="font-mono tabular-nums text-primary">
                                Suggested person
                              </span>
                            </div>
                            <p className="text-main-text-muted mt-1 leading-relaxed">
                              {r.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
