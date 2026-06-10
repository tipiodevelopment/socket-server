import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

// Operator session (ADR-0007). The session lives in an httpOnly cookie set
// by POST /api/auth/session, so every fetch in the app (they all send
// credentials) is authenticated without touching call sites. This context
// only mirrors the profile for the UI.

export interface OperatorProfile {
  id: number;
  email: string | null;
  name: string | null;
  role: 'super_admin' | 'admin' | 'operator' | 'viewer';
  sponsorId: number | null;
  linked: boolean;
}

interface UserContextValue {
  userId: number | null;
  userData: OperatorProfile | null;
  email: string | null;
  role: OperatorProfile['role'] | null;
  isLoading: boolean;
  loginWithIdToken: (idToken: string) => Promise<OperatorProfile>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      setProfile(res.ok ? await res.json() : null);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const loginWithIdToken = useCallback(async (idToken: string) => {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Login failed (${res.status})`);
    }
    const operator: OperatorProfile = await res.json();
    setProfile(operator);
    return operator;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
    } catch {
      // best effort — the cookie is httpOnly, only the server can clear it
    }
    if (isFirebaseConfigured()) {
      await signOut(getFirebaseAuth()).catch(() => undefined);
    }
    setProfile(null);
  }, []);

  return (
    <UserContext.Provider
      value={{
        userId: profile?.id ?? null,
        userData: profile,
        email: profile?.email ?? null,
        role: profile?.role ?? null,
        isLoading,
        loginWithIdToken,
        logout,
        refresh,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
