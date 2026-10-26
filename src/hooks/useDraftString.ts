import { useEffect, useState } from 'react';

const drafts = new Map<string, string>();
/** Keeps entered text across page navigation in memory only; never writes drafts to device storage. */
export function useDraftString(key: string, initial = '') {
  const [value, setValue] = useState(() => drafts.get(key) ?? initial);
  useEffect(() => { drafts.set(key, value); }, [key, value]);
  return [value, setValue] as const;
}
export function clearSessionDrafts() { drafts.clear(); }
