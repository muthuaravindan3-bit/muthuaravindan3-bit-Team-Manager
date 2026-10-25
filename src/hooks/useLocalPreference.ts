import { useEffect, useState } from 'react';
import type { ZodType } from 'zod';

/** Small local UI preferences are validated independently of operational records. */
export function useLocalPreference<T>(key: string, initial: T, schema: ZodType<T>) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); const result = schema.safeParse(raw ? JSON.parse(raw) : initial); return result.success ? result.data : initial; }
    catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* UI preference remains usable in memory. */ } }, [key, value]);
  return [value, setValue] as const;
}
