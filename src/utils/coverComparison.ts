import type { Shift } from '../types';

/** Compares stored schedule-local intervals, including overnight shifts. It does not infer eligibility. */
export function shiftsOverlap(first: Pick<Shift, 'date' | 'startTime' | 'endTime'>, second: Pick<Shift, 'date' | 'startTime' | 'endTime'>): boolean {
  const interval = (shift: typeof first) => {
    const start = Date.parse(`${shift.date}T${shift.startTime}:00Z`);
    const end = Date.parse(`${shift.date}T${shift.endTime}:00Z`);
    return [start, end <= start ? end + 86400000 : end];
  };
  const [a, b] = interval(first); const [c, d] = interval(second);
  return a < d && c < b;
}
