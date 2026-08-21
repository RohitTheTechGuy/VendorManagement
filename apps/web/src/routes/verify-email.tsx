import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { OTP_LENGTH, verifyEmailSchema } from "@vendor-management/shared";
import { useAuth } from "../lib/auth-context.js";
import { apiResendOtp, errorMessage } from "../lib/auth-api.js";
import { OtpInput } from "../components/OtpInput.js";

const RESEND_COOLDOWN_S = 60;

export function VerifyEmailPage() {
  const { user, loading, verifyEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  // Tick down the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!loading && user) return <Navigate to="/" replace />;
  // Landed here without registering (no email carried over) — start over.
  if (!email) return <Navigate to="/register" replace />;

  async function submit(value: string) {
    setError(null);
    const parsed = verifyEmailSchema.safeParse({ email, code: value });
    if (!parsed.success) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setSubmitting(true);
    try {
      await verifyEmail(parsed.data);
      navigate("/", { replace: true });
    } catch (e) {
      setError(errorMessage(e, "Could not verify the code. Please try again."));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    try {
      await apiResendOtp(email);
      setNotice("A new code is on its way.");
      setCode("");
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      setError(errorMessage(e, "Could not resend the code."));
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-muted p-6 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Verify your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the {OTP_LENGTH}-digit code we sent to{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>
        )}
        {notice && !error && (
          <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(code);
          }}
          className="mt-6"
        >
          <OtpInput
            value={code}
            onChange={setCode}
            length={OTP_LENGTH}
            disabled={submitting}
            autoFocus
            onComplete={(v) => void submit(v)}
          />
          <button
            type="submit"
            disabled={submitting || code.length < OTP_LENGTH}
            className="mt-6 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? "Verifying…" : "Verify"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Wrong email?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Start over
          </Link>
        </p>
      </div>
    </main>
  );
}
