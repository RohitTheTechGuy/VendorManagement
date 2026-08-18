import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { loginSchema, type UserType } from "@vendor-management/shared";
import { useAuth } from "../lib/auth-context.js";
import { errorMessage } from "../lib/auth-api.js";
import { Logo } from "../components/Logo.js";
import { LoginHero } from "../components/LoginHero.js";

const homeFor = (userType: UserType) => (userType === "BUYER" ? "/" : "/vendor");

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<UserType>("BUYER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in — send them to their own side of the app.
  if (!loading && user) return <Navigate to={homeFor(user.userType)} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      // The server decides the actual user type; we route by that, not the tab.
      const signedIn = await login(parsed.data);
      navigate(homeFor(signedIn.userType), { replace: true });
    } catch (error) {
      setFormError(errorMessage(error, "Could not sign in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  const isBuyer = portal === "BUYER";
  const inputCls =
    "mt-2 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[5fr_7fr]">
      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm animate-fade-up">
          <Logo />

          <h1 className="mt-9 font-display text-3xl font-semibold tracking-tight">
            Sign <span className="italic text-gradient">in</span>
          </h1>
          <p className="label-mono mt-2 block">{isBuyer ? "Buyer console" : "Vendor portal"}</p>

          {/* Buyer / Vendor toggle */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1 font-mono text-[11px] uppercase tracking-[0.12em]">
            {(["BUYER", "VENDOR"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPortal(p);
                  setFormError(null);
                }}
                className={`rounded-md px-3 py-1.5 transition ${
                  portal === p
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "BUYER" ? "Buyer" : "Vendor"}
              </button>
            ))}
          </div>

          {formError && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {formError}
            </p>
          )}

          <label className="mt-6 block">
            <span className="label-mono">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputCls}
            />
            {fieldErrors.email && (
              <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.email[0]}</span>
            )}
          </label>

          <label className="mt-4 block">
            <span className="label-mono">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={inputCls}
            />
            {fieldErrors.password && (
              <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.password[0]}</span>
            )}
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition-all hover:brightness-110 motion-safe:active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in →"}
          </button>

          {isBuyer ? (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link to="/register" className="font-medium text-gradient hover:underline">
                Create one
              </Link>
            </p>
          ) : (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Vendors get started from the magic link in their invite email, which sets a password.
            </p>
          )}
        </form>
      </div>

      {/* Hero panel (brand + animation) */}
      <div className="relative hidden overflow-hidden border-l border-border bg-card lg:block">
        <LoginHero />
      </div>
    </main>
  );
}
