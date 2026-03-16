import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@shared/schema';

const USER_SESSION_KEY = "reachu_simulated_user_id";

interface UserContextValue {
  userId: number | null;
  userData: User | null;
  reachuUserId: string | null;
  isLoading: boolean;
  login: (reachuUserId: string) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [reachuUserId, setReachuUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const ensureUser = useCallback(async (storedId: string) => {
    try {
      const res = await fetch('/api/users/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reachuUserId: storedId })
      });
      if (!res.ok) throw new Error('Failed to ensure user');
      const user = await res.json();
      setUserId(user.id);
      setUserData(user);
      setReachuUserId(storedId);
    } catch {
      localStorage.removeItem(USER_SESSION_KEY);
      setUserId(null);
      setUserData(null);
      setReachuUserId(null);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(USER_SESSION_KEY);
    if (stored) {
      ensureUser(stored).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [ensureUser]);

  const login = useCallback(async (id: string) => {
    setIsLoading(true);
    localStorage.setItem(USER_SESSION_KEY, id);
    await ensureUser(id);
    setIsLoading(false);
  }, [ensureUser]);

  const logout = useCallback(() => {
    localStorage.removeItem(USER_SESSION_KEY);
    setUserId(null);
    setUserData(null);
    setReachuUserId(null);
  }, []);

  return (
    <UserContext.Provider value={{ userId, userData, reachuUserId, isLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}
