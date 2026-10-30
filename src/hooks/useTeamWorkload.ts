import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { z } from 'zod';
import { db } from '../firebase';
const schema = z.array(z.object({ userId: z.string(), date: z.string() }));
/** Counts recorded assignments for an explicitly displayed seven-day window. */
export function useTeamWorkload() {
  const [records, setRecords] = useState<z.infer<typeof schema> | null>(null);
  const start = new Date().toLocaleDateString('en-CA');
  const endDay = new Date(); endDay.setDate(endDay.getDate() + 6);
  const end = endDay.toLocaleDateString('en-CA');
  useEffect(() => onSnapshot(collection(db, 'shifts'), (snapshot) => {
    const parsed = schema.safeParse(snapshot.docs.map((record) => record.data()));
    setRecords(parsed.success ? parsed.data : null);
  }, () => setRecords(null)), []);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    records?.filter((record) => record.date >= start && record.date <= end).forEach((record) => result.set(record.userId, (result.get(record.userId) ?? 0) + 1));
    return result;
  }, [records, start, end]);
  return { counts, isAvailable: records !== null, start, end };
}
