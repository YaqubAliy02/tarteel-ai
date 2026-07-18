/**
 * Auth state: JWT + user profile, persisted in the device's secure store.
 * setAuthToken() feeds the token to the API layer so every request carries it.
 */
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { loginAccount, registerAccount, setAuthToken, type AuthUser } from '@/lib/api';

const TOKEN_KEY = 'hujra.token';
const USER_KEY = 'hujra.user';

type AuthStore = {
  user: AuthUser | null;
  ready: boolean; // secure-store read finished
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthStore | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [token, rawUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (token && rawUser) {
          setAuthToken(token);
          setUser(JSON.parse(rawUser) as AuthUser);
        }
      } catch {
        // corrupted store -> start signed out
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (token: string, nextUser: AuthUser) => {
    setAuthToken(token);
    setUser(nextUser);
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser)),
    ]);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await loginAccount(email, password);
      await persist(token, u);
    },
    [persist],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { token, user: u } = await registerAccount(email, password, displayName);
      await persist(token, u);
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut }),
    [user, ready, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthStore {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
