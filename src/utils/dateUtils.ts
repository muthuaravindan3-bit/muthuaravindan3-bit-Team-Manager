import { format, parseISO, isValid } from 'date-fns';

/**
 * Safely converts numbers, strings, Date objects, or Firestore Timestamp-like objects into a valid Date.
 */
export function toSafeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  if (typeof value === 'string') {
    const parsedIso = parseISO(value);
    if (isValid(parsedIso)) return parsedIso;
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis: unknown }).toMillis === 'function'
  ) {
    const ms = (value as { toMillis: () => number }).toMillis();
    const d = new Date(ms);
    return isValid(d) ? d : null;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number'
  ) {
    const secs = (value as { seconds: number }).seconds;
    const d = new Date(secs * 1000);
    return isValid(d) ? d : null;
  }
  return null;
}

/**
 * Safely formats any timestamp/date value with date-fns without throwing RangeError.
 */
export function safeFormat(
  value: unknown,
  pattern: string,
  fallback = '--'
): string {
  const d = toSafeDate(value);
  if (!d) return fallback;
  try {
    return format(d, pattern);
  } catch {
    return fallback;
  }
}
