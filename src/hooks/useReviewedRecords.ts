import { useCallback, useRef, useState } from 'react';

/** Holds incoming list changes until the user chooses to replace the visible records. */
export function useReviewedRecords<T>() {
  const [records, setRecords] = useState<T[]>([]);
  const [pending, setPending] = useState<T[] | null>(null);
  const current = useRef<string | null>(null);
  const receive = useCallback((next: T[]) => {
    const fingerprint = JSON.stringify(next);
    if (current.current === null) { current.current = fingerprint; setRecords(next); return; }
    setPending(current.current === fingerprint ? null : next);
  }, []);
  const review = () => { if (pending) { current.current = JSON.stringify(pending); setRecords(pending); setPending(null); } };
  return [records, receive, { hasUpdates: pending !== null, review }] as const;
}
