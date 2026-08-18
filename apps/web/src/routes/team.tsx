import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import {
  BUYER_ROLES,
  BUYER_ROLE_LABEL,
  createTeamMemberSchema,
  type BuyerRole,
  type TeamMember,
} from "@vendor-management/shared";
import { AppShell } from "../components/AppShell.js";
import { Button, Card, Spinner, cn } from "../components/ui.js";
import { useAuth } from "../lib/auth-context.js";
import { listTeam, createTeamMember, removeTeamMember } from "../lib/team-api.js";
import { errorMessage } from "../lib/auth-api.js";

const ROLE_STYLE: Record<BuyerRole, string> = {
  OWNER: "bg-foreground text-background",
  QUALITY: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  FINANCE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  TAX: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  LEGAL: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

export function TeamPage() {
  const { role } = useAuth();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [memberRole, setMemberRole] = useState<BuyerRole>("QUALITY");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    listTeam().then(setMembers).catch(() => setMembers([]));
  }
  useEffect(load, []);

  // Only owners manage the team.
  if (role && role !== "OWNER") return <Navigate to="/" replace />;

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = createTeamMemberSchema.safeParse({ email, fullName, role: memberRole, password });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createTeamMember(parsed.data);
      setEmail("");
      setFullName("");
      setPassword("");
      setMemberRole("QUALITY");
      load();
    } catch (error) {
      setFormError(errorMessage(error, "Could not add the team member."));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(m: TeamMember) {
    await removeTeamMember(m.id).catch(() => undefined);
    load();
  }

  const inputCls = "mt-1 w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-ring";

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-semibold">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add buyer teammates and assign their role. Approvers (Quality, Finance, Tax, Legal) get their own
        review queue; the four approver seats are what a vendor's approvals require.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          {members === null ? (
            <div className="flex items-center gap-3 p-6 text-muted-foreground">
              <Spinner /> Loading…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {m.fullName ?? "—"}
                      {m.isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ROLE_STYLE[m.role])}>
                        {BUYER_ROLE_LABEL[m.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void onRemove(m)}
                        disabled={m.isSelf}
                        className={cn(
                          "rounded-md px-2 py-1 text-xs font-medium",
                          m.isSelf ? "cursor-not-allowed text-muted-foreground" : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10",
                        )}
                        title={m.isSelf ? "You can't remove yourself" : "Remove"}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="h-fit p-6">
          <h2 className="text-lg font-semibold">Add a teammate</h2>
          <form onSubmit={onAdd} className="mt-4 space-y-4">
            {formError && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{formError}</p>
            )}
            <label className="block text-sm font-medium">
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
              {fieldErrors.fullName && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.fullName[0]}</span>}
            </label>
            <label className="block text-sm font-medium">
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              {fieldErrors.email && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.email[0]}</span>}
            </label>
            <label className="block text-sm font-medium">
              Role
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as BuyerRole)} className={inputCls}>
                {BUYER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {BUYER_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Temporary password
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              {fieldErrors.password && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.password[0]}</span>}
              <span className="mt-1 block text-xs text-muted-foreground">Share this with the teammate so they can sign in.</span>
            </label>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Adding…" : "Add teammate"}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
