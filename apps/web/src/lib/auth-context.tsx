import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
  AuthUser,
  LoginInput,
  RegisterInput,
  RegisterResponse,
  UserType,
  VerifyEmailInput,
} from "@vendor-management/shared";
import { apiLogin, apiLogout, apiMe, apiRegister, apiVerifyEmail } from "./auth-api.js";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  // Convenience projections of the current user's identity for route guards.
  userType: UserType | null;
  role: string | null;
  login: (input: LoginInput) => Promise<AuthUser>;
  // Register starts email verification — it does NOT sign the user in.
  register: (input: RegisterInput) => Promise<RegisterResponse>;
  // Verifying the OTP creates the account and signs the user in.
  verifyEmail: (input: VerifyEmailInput) => Promise<AuthUser>;
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
      // No session yet — the user must verify their email first.
      return apiRegister(input);
    },
    verifyEmail: async (input) => {
      const u = await apiVerifyEmail(input);
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
