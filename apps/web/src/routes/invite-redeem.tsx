import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { setVendorPasswordSchema } from "@vendor-management/shared";
import { useAuth } from "../lib/auth-context.js";
import { redeemInvite, setVendorPassword } from "../lib/vendor-api.js";
import { errorMessage } from "../lib/auth-api.js";
import { Button, Card, Spinner } from "../components/ui.js";

type Phase = "redeeming" | "set-password" | "error";

export function InviteRedeemPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [phase, setPhase] = useState<Phase>("redeeming");
  const [linkId, setLinkId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redeem exactly once on mount (StrictMode guard).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const result = await redeemInvite(token);
        setLinkId(result.linkId);
        setTitle(result.requirementTitle);
        await refresh(); // the redeem set our session cookie
        if (result.needsPassword) {
          setPhase("set-password");
        } else {
          navigate(`/vendor/${result.linkId}`, { replace: true });
        }
      } catch (err) {
        setError(errorMessage(err, "This invite link could not be opened."));
        setPhase("error");
      }
    })();
  }, [token, navigate, refresh]);

  async function onSetPassword(event: FormEvent) {
    event.preventDefault();
    const parsed = setVendorPasswordSchema.safeParse({ password });
    if (!parsed.success) {
      setFieldError(parsed.error.flatten().fieldErrors.password?.[0] ?? "Invalid password");
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await setVendorPassword(password);
      await refresh();
      navigate(`/vendor/${linkId}`, { replace: true });
    } catch (err) {
      setFieldError(errorMessage(err, "Could not set your password."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-6 text-slate-900">
      <Card className="w-full max-w-sm p-8">
        {phase === "redeeming" && (
          <div className="flex items-center gap-3 text-slate-500">
            <Spinner /> Opening your invitation…
          </div>
        )}

        {phase === "error" && (
          <div>
            <h1 className="text-xl font-bold">Invite link problem</h1>
            <p className="mt-2 text-sm text-rose-700">{error}</p>
          </div>
        )}

        {phase === "set-password" && (
          <form onSubmit={onSetPassword}>
            <h1 className="text-2xl font-bold">Welcome</h1>
            <p className="mt-1 text-sm text-slate-500">
              You've been invited to onboard for <span className="font-medium">{title}</span>. Set a
              password to continue.
            </p>
            <label className="mt-5 block text-sm font-medium">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
              />
              {fieldError && <span className="mt-1 block text-xs text-rose-600">{fieldError}</span>}
            </label>
            <Button type="submit" disabled={submitting} className="mt-6 w-full">
              {submitting ? "Saving…" : "Set password & continue"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
