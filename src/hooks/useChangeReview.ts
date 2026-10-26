import { useRef, useState } from 'react';

export interface ChangeReviewState { lines: string[]; run: () => Promise<void> }
/** Keeps a failed change open for retry without discarding the owning form's values. */
export function useChangeReview() {
  const [review, setReview] = useState<ChangeReviewState | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const failed = useRef(false);
  const locked = useRef(false);
  const reportError = (_error: unknown, operation?: string, _path?: string | null) => {
    failed.current = true;
    setError(operation === 'list' || operation === 'get' ? 'Some records could not be loaded. Check your connection and reopen this page.' : 'Your changes could not be saved. Your entries are still here. Try again.');
  };
  const request = (lines: string[], run: () => Promise<void>) => { setError(''); setSuccess(false); setReview({ lines, run }); };
  const confirm = async () => {
    if (!review || locked.current) return;
    locked.current = true; failed.current = false; setBusy(true); setError('');
    try { await review.run(); if (!failed.current) { setReview(null); setSuccess(true); } }
    catch (cause) { reportError(cause); }
    finally { locked.current = false; setBusy(false); }
  };
  return { review, error, success, busy, request, reportError, confirm, close: () => { if (!locked.current) setReview(null); }, dismiss: () => { setError(''); setSuccess(false); } };
}
