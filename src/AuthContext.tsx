import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let currentProfile: any = null;

          if (!userDoc.exists()) {
            // Check if there's a placeholder record for this email
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email?.toLowerCase()));
            const querySnapshot = await getDocs(q);
            let placeholderData: any = null;
            let placeholderDocId: string | null = null;

            if (!querySnapshot.empty) {
              // Found a match by email
              const pDoc = querySnapshot.docs[0];
              placeholderData = pDoc.data();
              placeholderDocId = pDoc.id;
            }

            currentProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email?.toLowerCase(),
              displayName: placeholderData?.displayName || firebaseUser.displayName,
              employeeId: placeholderData?.employeeId || null,
              role: (firebaseUser.email === 'muthuaravindan3@gmail.com' || placeholderData?.role === 'admin') ? 'admin' : 'member',
              createdAt: placeholderData?.createdAt || Date.now(),
              lastLogin: Date.now(),
            };

            await setDoc(doc(db, 'users', firebaseUser.uid), currentProfile);

            // Clean up placeholder if it was a different document ID (like a slug)
            if (placeholderDocId && placeholderDocId !== firebaseUser.uid) {
              await deleteDoc(doc(db, 'users', placeholderDocId));
            }
          } else {
            currentProfile = userDoc.data();
            // Update last login and names if needed
            const updates: any = { lastLogin: Date.now() };
            if (!currentProfile.displayName && firebaseUser.displayName) {
              updates.displayName = firebaseUser.displayName;
            }
            if (!currentProfile.email && firebaseUser.email) {
              updates.email = firebaseUser.email.toLowerCase();
            }

            // Upgrade to admin if email matches exactly
            if (firebaseUser.email === 'muthuaravindan3@gmail.com' && currentProfile.role !== 'admin') {
              updates.role = 'admin';
            }

            if (Object.keys(updates).length > 0) {
              await setDoc(doc(db, 'users', firebaseUser.uid), updates, { merge: true });
              currentProfile = { ...currentProfile, ...updates };
            }
          }
          setProfile(currentProfile);
          
          // Check/Create admin doc
          if (firebaseUser.email === 'muthuaravindan3@gmail.com') {
            const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
            if (!adminDoc.exists()) {
              await setDoc(doc(db, 'admins', firebaseUser.uid), { email: firebaseUser.email });
            }
            setIsAdmin(true);
          } else {
            const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
            setIsAdmin(adminDoc.exists());
          }
          
        } catch (error) {
          console.error("Error fetching user profile", error);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'auth');
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, logout }}>
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
