import { useChangeReview } from '../hooks/useChangeReview';
import { ChangeReview } from './ui/ChangeReview';
import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { LeaveRequest } from '../types';
import { CalendarOff, Plus, Check, X } from 'lucide-react';
import { QuickDrawerType } from './Navigation';

interface LeavesProps {
  onOpenQuickDrawer?: (drawer: QuickDrawerType) => void;
  externalStatusFilter?: 'all' | 'pending' | 'accepted' | 'approved' | 'rejected';
  onChangeExternalStatusFilter?: (
    status: 'all' | 'pending' | 'accepted' | 'approved' | 'rejected'
  ) => void;
}

export default function Leaves({
  onOpenQuickDrawer,
  externalStatusFilter,
  onChangeExternalStatusFilter,
}: LeavesProps) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const changeReview = useChangeReview();
  const handleFirestoreError = changeReview.reportError;
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalStatusFilter, setInternalStatusFilter] = useState<
    'all' | 'pending' | 'accepted' | 'approved' | 'rejected'
  >('all');

  const statusFilter =
    externalStatusFilter === 'accepted'
      ? 'all'
      : externalStatusFilter ?? internalStatusFilter;
  const setStatusFilter =
    onChangeExternalStatusFilter ?? setInternalStatusFilter;

  useEffect(() => {
    if (authLoading || !user) return;

    const q = isAdmin
      ? collection(db, 'leaveRequests')
      : query(
          collection(db, 'leaveRequests'),
          where('userId', '==', user.uid)
        );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as LeaveRequest))
          .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
        setRequests(list);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'leaveRequests')
    );

    return () => unsub();
  }, [user, isAdmin, authLoading]);

  const handleUpdateStatus = async (
    id: string,
    status: 'approved' | 'rejected',
    confirmed = false
  ) => {
    if (!isAdmin) return;
    if (!confirmed) { const request = requests.find((entry) => entry.id === id); changeReview.request([`${status === 'approved' ? 'Approve' : 'Decline'} time off for ${request?.userName ?? 'this person'}`, `${request?.startDate} to ${request?.endDate}`, 'Existing shift assignments will not be removed.'], () => handleUpdateStatus(id, status, true)); return; }
    try {
      await updateDoc(doc(db, 'leaveRequests', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `leaveRequests/${id}`);
    }
  };

  const filteredRequests = requests.filter((r) =>
    statusFilter === 'all' ? true : r.status === statusFilter
  );

  return (
    <div className="space-y-5">
      <ChangeReview state={changeReview} />
      {/* Filter & Slide-Over Action Bar */}
      <div className="p-4 rounded-xl bg-surface-2 border border-main-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
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
              {st === 'all' ? `All Requests (${requests.length})` : st}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onOpenQuickDrawer?.('leave')}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Request Time Off</span>
        </button>
      </div>

      {loading ? (
        <div className="h-44 rounded-xl bg-surface-2 border border-main-border animate-pulse" />
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 rounded-xl bg-surface-2 border border-main-border text-center">
          <CalendarOff className="w-8 h-8 text-main-text-disabled mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-main-text">
            No time off requests in this view
          </h3>
          <p className="text-xs text-main-text-muted mt-1 max-w-md mx-auto">
            Need vacation, personal days, or medical leave? Open the slide-over request drawer to submit your dates.
          </p>
          <button
            type="button"
            onClick={() => onOpenQuickDrawer?.('leave')}
            className="btn-primary mt-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Request Time Off</span>
          </button>
        </div>
      ) : (
        <div className="bg-surface-2 border border-main-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-main-border text-xs font-semibold text-main-text-muted bg-surface-1/60">
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Review</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-main-border text-sm">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-surface-3/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-main-text">
                      {req.userName}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-main-text-muted">
                      {req.startDate} → {req.endDate}
                    </td>
                    <td className="py-3 px-4 text-xs text-main-text">
                      {req.reason}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold capitalize">
                      <span
                        className={
                          req.status === 'approved'
                            ? 'text-success'
                            : req.status === 'rejected'
                            ? 'text-error'
                            : 'text-primary'
                        }
                      >
                        {req.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        {req.status === 'pending' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateStatus(req.id, 'approved')
                              }
                              className="text-xs font-semibold text-success hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateStatus(req.id, 'rejected')
                              }
                              className="text-xs font-semibold text-error hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-main-text-disabled">
                            Reviewed
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
