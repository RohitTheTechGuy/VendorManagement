import { useState } from "react";
import type { Candidate, InviteResult, RequirementDetail } from "@vendor-management/shared";
import { dispatchInvites } from "../lib/candidates-api.js";
import { errorMessage } from "../lib/auth-api.js";
import { Modal } from "./Modal.js";
import { Button, cn } from "./ui.js";

export function SendInvitesModal({
  open,
  onClose,
  requirementId,
  pending,
  onDispatched,
}: {
  open: boolean;
  onClose: () => void;
  requirementId: string;
  pending: Candidate[]; // NOT_INVITED candidates
  onDispatched: (detail: RequirementDetail) => void;
}) {
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setResults(null);
    setError(null);
    onClose();
  }

  async function send() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await dispatchInvites(requirementId);
      setResults(response.results);
      onDispatched(response.requirement);
    } catch (e) {
      setError(errorMessage(e, "Could not send invites."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={results ? "Invites sent" : "Send invites"} maxWidth="max-w-lg">
      {results ? (
        <div>
          <p className="text-sm text-muted-foreground">
            {results.filter((r) => r.sent).length} emailed ·{" "}
            {results.filter((r) => !r.sent).length} logged to server console (dev).
          </p>
          <ul className="mt-4 space-y-2">
            {results.map((r) => (
              <li key={r.candidateId} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{r.email}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      r.sent ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {r.sent ? "Emailed" : "Logged (dev)"}
                  </span>
                </div>
                <a
                  href={r.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-xs text-primary hover:underline"
                >
                  {r.link}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">
            A magic-link invite will be sent to {pending.length}{" "}
            {pending.length === 1 ? "vendor" : "vendors"}:
          </p>
          <ul className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border">
            {pending.map((c) => (
              <li key={c.id} className="border-b border-border px-3 py-2 text-sm last:border-0">
                <span className="font-medium text-foreground">{c.legalName}</span>{" "}
                <span className="text-muted-foreground">· {c.contactEmail}</span>
              </li>
            ))}
          </ul>
          {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={send} disabled={submitting || pending.length === 0}>
              {submitting ? "Sending…" : `Send ${pending.length} ${pending.length === 1 ? "invite" : "invites"}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
