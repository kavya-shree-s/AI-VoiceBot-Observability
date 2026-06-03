"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const TOKEN_KEY = "breeze-bearer-token";

type AuthContextValue = {
  /** The current bearer token, or null when signed out. */
  token: string | null;
  /** False until sessionStorage has been read on the client (avoids a login flash). */
  hydrated: boolean;
  /** True when the last sign-out was caused by an expired/rejected token. */
  sessionExpired: boolean;
  signIn: (token: string) => void;
  signOut: (opts?: { expired?: boolean }) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored) setToken(stored);
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const signIn = useCallback((next: string) => {
    sessionStorage.setItem(TOKEN_KEY, next);
    setToken(next);
    setSessionExpired(false);
  }, []);

  const signOut = useCallback((opts?: { expired?: boolean }) => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSessionExpired(Boolean(opts?.expired));
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, hydrated, sessionExpired, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
