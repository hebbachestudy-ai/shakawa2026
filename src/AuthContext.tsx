import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    // Handle redirect result
    getRedirectResult(auth).then((result) => {
      if (result) {
        toast.success('تم تسجيل الدخول بنجاح عبر جوجل');
      }
    }).catch((error) => {
      console.error('Redirect sign-in error:', error);
      if (error.code !== 'auth/web-storage-unsupported') {
        toast.error('فشل تسجيل الدخول عبر جوجل (إعادة التوجيه).');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      // Cleanup previous listener if any
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      
      if (firebaseUser) {
        // Listen to profile changes
        const profileRef = doc(db, 'users', firebaseUser.uid);
        unsubProfile = onSnapshot(profileRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            console.warn("Profile document does not exist for user:", firebaseUser.uid);
            // Auto-create profile for Google users or designated admin
            const isAdminEmail = firebaseUser.email === 'hebbache.study@gmail.com';
            
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: isAdminEmail ? 'Admin' : 'Citizen',
              entity: 'Municipality',
              name: firebaseUser.displayName || (isAdminEmail ? 'المدير العام' : 'مستخدم جديد'),
              createdAt: new Date().toISOString(),
              status: 'Active'
            };

            try {
              await setDoc(profileRef, newProfile);
              setProfile(newProfile);
            } catch (err) {
              console.error("Error auto-creating profile:", err);
              setProfile(null);
            }
          }
          setLoading(false);
          setIsAuthReady(true);
        }, (error) => {
          console.error("Error fetching profile snapshot:", error);
          setProfile(null);
          setLoading(false);
          setIsAuthReady(true);
        });
      } else {
        setProfile(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
