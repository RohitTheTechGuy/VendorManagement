import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Candidate, InviteStatus, LinkState, RequirementDetail } from "@vendor-management/shared";
import { getRequirement, removeCandidate } from "../lib/candidates-api.js";
import { errorMessage } from "../lib/auth-api.js";
import { formatDate } from "../lib/format.js";
import { AppShell } from "../components/AppShell.js";
import { AddCandidateModal } from "../components/AddCandidateModal.js";
import { SendInvitesModal } from "../components/SendInvitesModal.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { VendorDrawer } from "../components/VendorDrawer.js";
import { Button, Card, Spinner, StageBadge, cn } from "../components/ui.js";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; detail: RequirementDetail };

const INVITE_STATUS: Record<InviteStatus, { label: string; className: string }> = {
  NOT_INVITED: { label: "Not invited", className: "bg-slate-100 text-slate-600" },
  INVITED: { label: "Invited", className: "bg-violet-50 text-violet-700" },
  OPENED: { label: "Opened", className: "bg-sky-50 text-sky-700" },
  EXPIRED: { label: "Expired", className: "bg-rose-50 text-rose-700" },
};

export function RequirementDetailPage() {
  const { id = "" } = useParams();
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [modalOpen, setModalOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [drawerLink, setDrawerLink] = useState<string | null>(null);

  function load() {
    setState({ kind: "loading" });
    getRequirement(id)
      .then((detail) => setState({ kind: "ready", detail }))
      .catch((error) => setState({ kind: "error", message: errorMessage(error, "Requirement not found.") }));
  }

  useEffect(load, [id]);

  async function onRemove(candidate: Candidate) {
    setRowError(null);
    try {
      await removeCandidate(id, candidate.id);
      const detail = await getRequirement(id);
      setState({ kind: "ready", detail });
    } catch (error) {
      setRowError(errorMessage(error, "Could not remove the candidate."));
    }
  }

  return (
    <AppShell>
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to requirements
      </Link>

      {state.kind === "loading" && (
        <div className="mt-16 grid place-items-center">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {state.kind === "error" && (
        <Card className="mt-8 p-8 text-center">
          <p className="text-sm text-rose-600">{state.message}</p>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="secondary" size="sm">
              Back to requirements
            </Button>
          </Link>
        </Card>
      )}

      {state.kind === "ready" && (
        <Ready
          detail={state.detail}
          onAdd={() => setModalOpen(true)}
          onSend={() => setSendOpen(true)}
          onRemove={onRemove}
          onOpenLink={setDrawerLink}
          rowError={rowError}
        />
      )}

      <VendorDrawer
        linkId={drawerLink}
        open={drawerLink !== null}
        onClose={() => setDrawerLink(null)}
        onChanged={load}
      />

      {state.kind === "ready" && (
        <>
          <AddCandidateModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            requirementId={id}
            onUpdated={(detail) => setState({ kind: "ready", detail })}
          />
          <SendInvitesModal
            open={sendOpen}
            onClose={() => setSendOpen(false)}
            requirementId={id}
            pending={state.detail.candidates.filter((c) => c.inviteStatus === "NOT_INVITED")}
            onDispatched={(detail) => setState({ kind: "ready", detail })}
          />
        </>
      )}
    </AppShell>
  );
}

function Ready({
  detail,
  onAdd,
  onSend,
  onRemove,
  onOpenLink,
  rowError,
}: {
  detail: RequirementDetail;
  onAdd: () => void;
  onSend: () => void;
  onRemove: (c: Candidate) => void;
  onOpenLink: (linkId: string) => void;
  rowError: string | null;
}) {
  const { title, stage, partCategory, plantLocation, targetAwardDate, processCategories, candidates } = detail;
  const pendingCount = candidates.filter((c) => c.inviteStatus === "NOT_INVITED").length;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <StageBadge stage={stage} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            {partCategory && <span>{partCategory}</span>}
            {plantLocation && <span>{plantLocation}</span>}
            {targetAwardDate && <span>Award by {formatDate(targetAwardDate)}</span>}
            {processCategories.length > 0 && <span>{processCategories.join(", ")}</span>}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Candidates <span className="text-slate-400">({candidates.length})</span>
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onAdd}>
            Add candidate
          </Button>
          <Button onClick={onSend} disabled={pendingCount === 0} title={pendingCount === 0 ? "No candidates left to invite" : undefined}>
            Send invites{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
        </div>
      </div>

      {rowError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{rowError}</p>}

      {candidates.length === 0 ? (
        <Card className="mt-4 grid place-items-center gap-2 p-12 text-center">
          <p className="text-base font-semibold">No candidates yet</p>
          <p className="max-w-sm text-sm text-slate-500">
            Add vendors from the verified directory or enter one manually to start.
          </p>
          <Button className="mt-2" onClick={onAdd}>
            Add candidate
          </Button>
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Invite</th>
                  <th className="px-4 py-3 font-medium">Engagement</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const status = INVITE_STATUS[c.inviteStatus];
                  const canRemove = c.inviteStatus === "NOT_INVITED";
                  return (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{c.legalName}</div>
                        <div className="text-xs text-slate-400">
                          {[c.city, c.state].filter(Boolean).join(", ") || c.pan || ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.contactEmail}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            c.source === "DIRECTORY" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {c.source === "DIRECTORY" ? "Directory" : "Manual"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.className)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.link ? (
                          <button
                            type="button"
                            onClick={() => onOpenLink(c.link!.id)}
                            className="transition hover:opacity-80"
                            title="Open vendor"
                          >
                            <StatusBadge state={c.link.state as LinkState} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onRemove(c)}
                          disabled={!canRemove}
                          title={canRemove ? "Remove candidate" : "Invited candidates can't be removed"}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                            canRemove
                              ? "text-rose-600 hover:bg-rose-50"
                              : "cursor-not-allowed text-slate-300",
                          )}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
