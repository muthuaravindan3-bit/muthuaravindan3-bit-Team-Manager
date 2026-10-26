import { useEffect, useState } from 'react';
import type { ZodType } from 'zod';

/** Persists validated UI preferences, never authentication tokens or server records. */
export function usePreference<T>(key: string, fallback: T, schema: ZodType<T>) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); const parsed = schema.safeParse(raw ? JSON.parse(raw) : fallback); return parsed.success ? parsed.data : fallback; }
    catch { return fallback; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* A blocked preference store does not prevent navigation. */ } }, [key, value]);
  return [value, setValue] as const;
}
