type RecordData = Record<string, unknown>;
interface Constraint { field?: string; op: string; value?: unknown }
interface Reference { path: string; constraints: Constraint[] }
const records = new Map<string, RecordData>();
const listeners = new Set<() => void>();
let nextId = 0;
let failNext = false;
const isAdmin = new URLSearchParams(location.search).get('testRole') === 'admin';
const date = (offset = 0) => { const day = new Date(); day.setDate(day.getDate() + offset + (new Date().getUTCHours() >= 17 ? 1 : 0)); return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`; };
records.set('users/test-member', { uid: 'test-member', displayName: 'Alex Morgan', email: 'alex@example.test', role: isAdmin ? 'admin' : 'member', timezone: 'UTC', employeeId: 'TEST-1', isBreakActive: false });
records.set('users/test-colleague', { uid: 'test-colleague', displayName: 'Jamie Lee', email: 'jamie@example.test', role: 'member', timezone: 'UTC', isBreakActive: false });
records.set('settings/global', { defaultTimezone: 'UTC', defaultHourlyRate: 25, maxBreakDurationMinutes: 30 });
for (let i = 0; i < 7; i++) records.set(`shifts/shift-${i}`, { userId: i % 2 ? 'test-colleague' : 'test-member', userName: i % 2 ? 'Jamie Lee' : 'Alex Morgan', date: date(i), startTime: i % 2 ? '22:00' : '09:00', endTime: i % 2 ? '06:00' : '17:00', type: i % 2 ? 'Night' : 'Morning', updatedAt: Date.now() - 3600000 });
records.set('leaveRequests/leave-1', { userId: 'test-member', userName: 'Alex Morgan', startDate: date(3), endDate: date(4), reason: 'Family visit', status: 'pending', createdAt: Date.now() - 7200000 });
records.set('shiftSwaps/swap-1', { requesterId: 'test-colleague', requesterName: 'Jamie Lee', shiftId: 'shift-1', shiftDate: date(1), shiftTime: '22:00 - 06:00', preferredTypes: ['Morning'], status: 'pending', createdAt: Date.now() - 7200000 });
records.set('incidentTickets/incident-1', { ticketNumber: 'TEST-001', title: 'Check the backup connection', description: 'Disposable test incident', status: 'investigating', tier: 'L1', team: 'Operations', creatorId: 'test-member', creatorName: 'Alex Morgan', assignedToName: 'Jamie Lee', shiftType: 'Morning', stepsTaken: ['Checked the cable'], createdAt: Date.now() });
records.set('announcements/notice-1', { content: 'Welcome to the isolated test workspace.', authorId: 'test-member', authorName: 'Alex Morgan', priority: 'low', createdAt: Date.now() });
if (isAdmin) records.set('admins/test-member', { email: 'alex@example.test' });

function snapshot(ref: Reference) {
  const make = (path: string, data?: RecordData) => ({ id: path.split('/').at(-1)!, ref: { path, constraints: [] }, exists: () => data !== undefined, data: () => data ? structuredClone(data) : undefined });
  if (ref.path.split('/').length % 2 === 0) return make(ref.path, records.get(ref.path));
  let items = [...records].filter(([path]) => path.startsWith(`${ref.path}/`) && path.split('/').length === ref.path.split('/').length + 1);
  for (const constraint of ref.constraints) {
    const { field, op, value } = constraint;
    if (op === '==') items = items.filter(([, data]) => data[field!] === value);
    else if (op === 'in') items = items.filter(([, data]) => Array.isArray(value) && value.includes(data[field!]));
    else if (op === 'array-contains') items = items.filter(([, data]) => Array.isArray(data[field!]) && (data[field!] as unknown[]).includes(value));
    else if (op === '>=') items = items.filter(([, data]) => String(data[field!]) >= String(value));
    else if (op === '<=') items = items.filter(([, data]) => String(data[field!]) <= String(value));
    else if (op === 'order') items.sort((a, b) => String(a[1][field!]).localeCompare(String(b[1][field!])) * (value === 'desc' ? -1 : 1));
    else if (op === 'limit') items = items.slice(0, Number(value));
  }
  const docs = items.map(([path, data]) => make(path, data));
  return { docs, empty: !docs.length, size: docs.length, forEach: (fn: (entry: ReturnType<typeof make>) => void) => docs.forEach(fn) };
}
export const getFirestore = () => ({});
export const collection = (_db: unknown, ...path: string[]): Reference => ({ path: path.join('/'), constraints: [] });
export const doc = collection;
export const where = (field: string, op: string, value: unknown): Constraint => ({ field, op, value });
export const orderBy = (field: string, value = 'asc'): Constraint => ({ field, op: 'order', value });
export const limit = (value: number): Constraint => ({ op: 'limit', value });
export const query = (ref: Reference, ...constraints: Constraint[]): Reference => ({ ...ref, constraints });
export function onSnapshot(ref: Reference, next: (value: unknown) => void) { const emit = () => next(snapshot(ref)); listeners.add(emit); queueMicrotask(emit); return () => listeners.delete(emit); }
export const getDoc = async (ref: Reference) => { if (sessionStorage.getItem('test-startup-hang') === 'read' && ref.path === 'users/test-member') return new Promise<ReturnType<typeof snapshot>>(() => {}); return snapshot(ref); };
export const getDocs = getDoc;
export const getDocFromServer = getDoc;
export const serverTimestamp = () => Date.now();
export const arrayUnion = (...values: unknown[]) => ({ __arrayUnion: values });
function checkWrite() { if (failNext) { failNext = false; throw new Error('Isolated simulated network failure'); } }
function notify() { queueMicrotask(() => listeners.forEach((listener) => listener())); }
function merge(path: string, data: RecordData) {
  const old = records.get(path) ?? {};
  const values = { ...data };
  for (const [key, value] of Object.entries(values)) if (value && typeof value === 'object' && '__arrayUnion' in value) values[key] = [...(Array.isArray(old[key]) ? old[key] : []), ...(value.__arrayUnion as unknown[])];
  records.set(path, { ...old, ...values });
}
export async function setDoc(ref: Reference, data: RecordData, options?: { merge?: boolean }) { if (sessionStorage.getItem('test-startup-hang') === 'write' && ref.path === 'users/test-member' && options?.merge) return new Promise<void>(() => {}); checkWrite(); if (options?.merge) merge(ref.path, data); else records.set(ref.path, data); notify(); }
export async function updateDoc(ref: Reference, data: RecordData) { checkWrite(); merge(ref.path, data); notify(); }
export async function addDoc(ref: Reference, data: RecordData) { const id = `created-${++nextId}`; await setDoc({ path: `${ref.path}/${id}`, constraints: [] }, data); return { id }; }
export async function deleteDoc(ref: Reference) { checkWrite(); records.delete(ref.path); notify(); }
declare global { interface Window { __shiftSyncTest: { failNextWrite: () => void; records: (name: string) => RecordData[]; insert: (path: string, data: RecordData) => void } } }
window.__shiftSyncTest = { failNextWrite: () => { failNext = true; }, records: (name) => [...records].filter(([path]) => path.startsWith(`${name}/`)).map(([path, data]) => ({ ...data, id: path.split('/').at(-1) })), insert: (path, data) => { records.set(path, data); notify(); } };
