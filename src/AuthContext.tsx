import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  query,
  collection,
  where,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSigningIn: boolean;
  authError: string | null;
  setAuthError: (error: string | null) => void;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const signingInRef = useRef(false);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const userEmailLower = firebaseUser.email?.toLowerCase() || '';
        const isMasterAdminEmail =
          userEmailLower === 'muthuaravindan3@gmail.com';

        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        let currentProfile: UserProfile;

        if (!userDoc.exists()) {
          // Check if there is a pre-registered placeholder record for this email
          let placeholderData: Partial<UserProfile> | null = null;
          let placeholderDocId: string | null = null;

          if (userEmailLower) {
            try {
              const q = query(
                collection(db, 'users'),
                where('email', '==', userEmailLower)
              );
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                const pDoc = querySnapshot.docs[0];
                placeholderData = pDoc.data() as Partial<UserProfile>;
                placeholderDocId = pDoc.id;
              }
            } catch {
              // Non-blocking lookup
            }
          }

          currentProfile = {
            uid: firebaseUser.uid,
            email: userEmailLower,
            displayName:
              placeholderData?.displayName ||
              firebaseUser.displayName ||
              'Team Member',
            employeeId: placeholderData?.employeeId || undefined,
            role:
              isMasterAdminEmail || placeholderData?.role === 'admin'
                ? 'admin'
                : 'member',
            createdAt: placeholderData?.createdAt || Date.now(),
            lastLogin: Date.now(),
          };

          await setDoc(userRef, {
            ...currentProfile,
            employeeId: currentProfile.employeeId || null,
          });

          if (placeholderDocId && placeholderDocId !== firebaseUser.uid) {
            try {
              await deleteDoc(doc(db, 'users', placeholderDocId));
            } catch {
              // Ignore non-critical placeholder cleanup
            }
          }
        } else {
          const existing = userDoc.data() as Partial<UserProfile>;
          const resolvedRole: 'admin' | 'member' =
            isMasterAdminEmail || existing.role === 'admin'
              ? 'admin'
              : 'member';
          const resolvedDisplayName =
            existing.displayName || firebaseUser.displayName || 'Team Member';
          const resolvedEmail = existing.email || userEmailLower;

          const updates: Record<string, unknown> = {
            uid: firebaseUser.uid,
            displayName: resolvedDisplayName,
            email: resolvedEmail || null,
            role: resolvedRole,
            lastLogin: Date.now(),
          };

          await setDoc(userRef, updates, { merge: true });
          currentProfile = {
            ...(existing as UserProfile),
            uid: firebaseUser.uid,
            displayName: resolvedDisplayName,
            email: resolvedEmail,
            role: resolvedRole,
            lastLogin: Date.now(),
          };
        }

        // Resolve admin status before mounting workspace listeners
        let resolvedAdmin =
          isMasterAdminEmail || currentProfile.role === 'admin';

        if (isMasterAdminEmail) {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
            if (!adminDoc.exists()) {
              await setDoc(doc(db, 'admins', firebaseUser.uid), {
                email: userEmailLower,
              });
            }
          } catch {
            // Non-blocking shadow admin sync
          }
        } else {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
            if (adminDoc.exists()) {
              resolvedAdmin = true;
            }
          } catch {
            // Fallback to role on profile
          }
        }

        setProfile(currentProfile);
        setIsAdmin(resolvedAdmin);
        setUser(firebaseUser);

        // Keep profile reactive in real time (for break timer, timezone, role updates)
        unsubProfile = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              const liveData = snap.data() as UserProfile;
              setProfile({ ...liveData, uid: snap.id });
              if (liveData.role === 'admin' || isMasterAdminEmail) {
                setIsAdmin(true);
              }
            }
          },
          () => {}
        );
      } catch (error) {
        console.error('Error setting up user profile:', error);
        const fallbackAdmin =
          firebaseUser.email?.toLowerCase() === 'muthuaravindan3@gmail.com';
        setProfile({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Team Member',
          role: fallbackAdmin ? 'admin' : 'member',
        });
        setIsAdmin(fallbackAdmin);
        setUser(firebaseUser);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // Continuous Live GPS Telemetry while user is on an active break
  useEffect(() => {
    if (
      !user ||
      !profile?.isBreakActive ||
      typeof navigator === 'undefined' ||
      !('geolocation' in navigator)
    ) {
      return;
    }

    let lastRecordedTime = 0;
    const activeLogId = profile.activeBreakLogId;

    const recordPosition = async (pos: GeolocationPosition) => {
      const now = Date.now();
      // Throttle Firestore writes to at most once every 8 seconds
      if (now - lastRecordedTime < 8000) return;
      lastRecordedTime = now;

      const point = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        timestamp: now,
      };

      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastLocation: point,
        });
        if (activeLogId) {
          await updateDoc(doc(db, 'breakLogs', activeLogId), {
            path: arrayUnion(point),
          });
        }
      } catch {
        // Non-blocking telemetry update
      }
    };

    navigator.geolocation.getCurrentPosition(
      recordPosition,
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      recordPosition,
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user, profile?.isBreakActive, profile?.activeBreakLogId]);

  const signIn = async () => {
    if (signingInRef.current || isSigningIn) {
      return;
    }

    signingInRef.current = true;
    setIsSigningIn(true);
    setAuthError(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      const errObj = error as { code?: string; message?: string };
      const code = errObj?.code || '';
      const msg = errObj?.message || String(error);

      if (
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/popup-closed-by-user' ||
        msg.includes('cancelled-popup-request') ||
        msg.includes('popup-closed-by-user') ||
        msg.includes('Pending promise was never set')
      ) {
        setAuthError(
          'Sign-in window was closed. Please click Sign In again to continue.'
        );
      } else if (
        code === 'auth/popup-blocked' ||
        msg.includes('popup-blocked')
      ) {
        setAuthError(
          'The sign-in popup was blocked by your browser settings. Please allow popups for this site and try again.'
        );
      } else {
        console.error('Authentication error during signInWithPopup:', error);
        setAuthError(
          error instanceof Error
            ? error.message
            : 'Authentication could not be completed. Please try again.'
        );
      }
    } finally {
      signingInRef.current = false;
      setIsSigningIn(false);
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isSigningIn,
        authError,
        setAuthError,
        signIn,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
