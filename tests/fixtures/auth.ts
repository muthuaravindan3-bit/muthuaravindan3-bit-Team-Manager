export interface User { uid: string; displayName: string; email: string; emailVerified: boolean; isAnonymous: boolean; tenantId: null; providerData: [] }
const user: User = { uid: 'test-member', displayName: 'Alex Morgan', email: 'alex@example.test', emailVerified: true, isAnonymous: false, tenantId: null, providerData: [] };
const auth = { currentUser: new URLSearchParams(location.search).get('signedOut') === '1' ? null : user };
const listeners = new Set<(user: User | null) => void>();
export function getAuth() { return auth; }
export class GoogleAuthProvider { setCustomParameters() {} }
export function onAuthStateChanged(_auth: unknown, listener: (user: User | null) => void) { listeners.add(listener); queueMicrotask(() => listener(auth.currentUser)); return () => listeners.delete(listener); }
export async function signInWithPopup() { auth.currentUser = user; listeners.forEach((listener) => listener(user)); return { user }; }
export async function signOut() { auth.currentUser = null; listeners.forEach((listener) => listener(null)); }
