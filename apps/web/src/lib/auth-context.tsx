import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser, LoginInput, RegisterInput, UserType } from "@vendor-management/shared";
import { apiLogin, apiLogout, apiMe, apiRegister } from "./auth-api.js";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  // Convenience projections of the current user's identity for route guards.
  userType: UserType | null;
  role: string | null;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  // Re-read the session (used after a magic-link redeem sets the cookie server-side).
  refresh: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check the session once on load.
  useEffect(() => {
    let cancelled = false;
    apiMe()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    userType: user?.userType ?? null,
    role: user?.role ?? null,
    // Return the user so callers can route by userType immediately after login.
    login: async (input) => {
      const u = await apiLogin(input);
      setUser(u);
      return u;
    },
    register: async (input) => {
      const u = await apiRegister(input);
      setUser(u);
      return u;
    },
    logout: async () => {
      await apiLogout();
      setUser(null);
    },
    refresh: async () => {
      const u = await apiMe();
      setUser(u);
      return u;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
