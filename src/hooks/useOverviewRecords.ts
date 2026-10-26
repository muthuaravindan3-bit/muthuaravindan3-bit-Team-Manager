import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { z } from 'zod';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';

const shiftSchema = z.object({ id: z.string(), userId: z.string(), userName: z.string(), date: z.string(), startTime: z.string(), endTime: z.string(), type: z.string(), updatedAt: z.number().optional() });
const requestSchema = z.object({ id: z.string(), userId: z.string().optional(), requesterId: z.string().optional(), userName: z.string().optional(), requesterName: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional(), shiftDate: z.string().optional(), status: z.enum(['pending', 'accepted', 'approved', 'rejected', 'cancelled']), createdAt: z.number() });
const incidentSchema = z.object({ id: z.string(), title: z.string(), status: z.enum(['open', 'investigating', 'mitigated', 'resolved']), assignedToName: z.string().optional(), creatorName: z.string(), createdAt: z.number() });
export type OverviewShift = z.infer<typeof shiftSchema>;
export type OverviewRequest = z.infer<typeof requestSchema>;
export type OverviewIncident = z.infer<typeof incidentSchema>;

function useRecords<T>(name: string, schema: z.ZodType<T>, ownerField?: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<T[]>([]);
  const [pending, setPending] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user) return;
    let initial = true;
    setLoading(true); setError(false); setRecords([]); setPending(null);
    const source = ownerField ? query(collection(db, name), where(ownerField, '==', user.uid)) : collection(db, name);
    return onSnapshot(source, (snapshot) => {
      const parsed = z.array(schema).safeParse(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })));
      setLoading(false);
      if (!parsed.success) { setError(true); return; }
      setError(false);
      if (initial) { setRecords(parsed.data); initial = false; }
      else setPending(parsed.data);
    }, () => { setError(true); setLoading(false); });
  }, [name, schema, ownerField, user?.uid, attempt]);
  return { records, loading, error, hasUpdates: pending !== null, review: () => { if (pending) setRecords(pending); setPending(null); }, retry: () => setAttempt((value) => value + 1) };
}

/** Read-only summaries; subsequent snapshots wait for explicit review. */
export function useOverviewRecords() {
  const { isAdmin } = useAuth();
  const shifts = useRecords('shifts', shiftSchema);
  const leaves = useRecords('leaveRequests', requestSchema, isAdmin ? undefined : 'userId');
  const swaps = useRecords('shiftSwaps', requestSchema, isAdmin ? undefined : 'requesterId');
  const incidents = useRecords('incidentTickets', incidentSchema);
  const feeds = [shifts, leaves, swaps, incidents];
  return { shifts: shifts.records, leaves: leaves.records, swaps: swaps.records, incidents: incidents.records, loading: feeds.some((feed) => feed.loading), error: feeds.some((feed) => feed.error), hasUpdates: feeds.some((feed) => feed.hasUpdates), review: () => feeds.forEach((feed) => feed.review()), retry: () => feeds.forEach((feed) => feed.retry()) };
}
