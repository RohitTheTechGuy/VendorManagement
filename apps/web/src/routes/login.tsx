import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { loginSchema, type UserType } from "@vendor-management/shared";
import { useAuth } from "../lib/auth-context.js";
import { errorMessage } from "../lib/auth-api.js";

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

  return (
    <main className="min-h-screen grid place-items-center bg-muted p-6 text-foreground">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isBuyer ? "Buyer console" : "Vendor portal"}
        </p>

        {/* Buyer / Vendor toggle */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium">
          {(["BUYER", "VENDOR"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPortal(p);
                setFormError(null);
              }}
              className={`rounded-md px-3 py-1.5 transition ${
                portal === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "BUYER" ? "Buyer" : "Vendor"}
            </button>
          ))}
        </div>

        {formError && (
          <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{formError}</p>
        )}

        <label className="mt-5 block text-sm font-medium">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-ring"
          />
          {fieldErrors.email && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.email[0]}</span>}
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-ring"
          />
          {fieldErrors.password && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.password[0]}</span>}
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        {isBuyer ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        ) : (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Vendors get started from the magic link in their invite email, which sets a password.
          </p>
        )}
      </form>
    </main>
  );
}
