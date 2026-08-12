import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CHECK_META,
  PREQUAL_CHECKS,
  DEEP_CHECKS,
  type BuyerLinkDetail,
  type VerificationCheckDTO,
  type VerificationCheckType,
} from "@vendor-management/shared";
import { Modal } from "./Modal.js";
import { StatusBadge } from "./StatusBadge.js";
import { ContractsPanel } from "./ContractsPanel.js";
import { Button, Card, Spinner, cn } from "./ui.js";
import { usePolling } from "../lib/use-polling.js";
import { useAuth } from "../lib/auth-context.js";
import {
  getBuyerLink,
  runCheck,
  resolveCheck,
  requestChanges,
  reviewClear,
  reviewReject,
  awardLink,
  advanceToContracts,
  pushErp,
  retryErp,
  erpPackUrl,
} from "../lib/buyer-api.js";
import { decideTask } from "../lib/approver-api.js";
import { fileUrl } from "../lib/files-api.js";

const APPROVER_ROLES = ["QUALITY", "FINANCE", "TAX", "LEGAL"];

const TASK_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  APPROVED: "bg-emerald-50 text-emerald-700",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-700",
};

const PREQUAL_STATES = new Set([
  "PREQUAL_IN_PROGRESS",
  "PREQUAL_SUBMITTED",
  "PREQUAL_UNDER_REVIEW",
  "PREQUAL_CLEARED",
  "INVITED",
]);

const CHECK_STATUS_STYLE: Record<string, string> = {
  RUNNING: "bg-sky-50 text-sky-700",
  PASSED: "bg-emerald-50 text-emerald-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-rose-50 text-rose-700",
  REJECTED: "bg-rose-50 text-rose-700",
  NEEDS_REVIEW: "bg-amber-50 text-amber-700",
};

function CheckRow({
  type,
  check,
  linkId,
  onChanged,
}: {
  type: VerificationCheckType;
  check: VerificationCheckDTO | undefined;
  linkId: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const status = check?.status;
  const running = status === "RUNNING";

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
      <div>
        <span className="text-sm font-medium">{CHECK_META[type].label}</span>
        {check?.matchScore != null && status !== "RUNNING" && (
          <span className="ml-2 text-xs text-slate-400">match {check.matchScore}%</span>
        )}
        {typeof check?.detail === "object" && check?.detail !== null && "reason" in check.detail && (
          <p className="text-xs text-slate-400">{String((check.detail as { reason: unknown }).reason)}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {status && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              CHECK_STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600",
            )}
          >
            {running && <Spinner className="h-3 w-3 border-[1.5px]" />}
            {status.replace("_", " ").toLowerCase()}
          </span>
        )}
        {status === "NEEDS_REVIEW" ? (
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(() => resolveCheck(linkId, check!.id, "accept"))}>
              Accept
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => resolveCheck(linkId, check!.id, "reject"))}>
              Reject
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" disabled={busy || running} onClick={() => void act(() => runCheck(linkId, type))}>
            {check ? "Re-run" : "Run check"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function VendorDrawer({
  linkId,
  open,
  onClose,
  onChanged,
}: {
  linkId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { role } = useAuth();
  const { data: link, refresh } = usePolling<BuyerLinkDetail>(
    () => getBuyerLink(linkId as string),
    { active: open && !!linkId, intervalMs: 3000 },
  );

  const [score, setScore] = useState("80");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [approverComment, setApproverComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function bump() {
    void refresh();
    onChanged();
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      bump();
    } catch (e) {
      setErr((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const checkTypes: VerificationCheckType[] =
    link && PREQUAL_STATES.has(link.state) ? PREQUAL_CHECKS : [...PREQUAL_CHECKS, ...DEEP_CHECKS];
  const checkByType = new Map((link?.checks ?? []).map((c) => [c.checkType, c]));

  return (
    <Modal open={open} onClose={onClose} title="Vendor" maxWidth="max-w-3xl">
      {!link ? (
        <div className="flex items-center gap-3 py-8 text-slate-400">
          <Spinner /> Loading…
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{link.candidate.legalName}</h3>
              <p className="text-sm text-slate-500">{link.candidate.contactEmail}</p>
            </div>
            <div className="text-right">
              <StatusBadge state={link.state} />
              {link.prequalScore != null && (
                <p className="mt-1 text-xs text-slate-400">Score {link.prequalScore}</p>
              )}
            </div>
          </div>

          {/* Submitted details */}
          {Object.keys(link.fields).length > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold">Submitted details</h4>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {Object.entries(link.fields).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-slate-400">{k}</dt>
                    <dd className="truncate">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {/* Documents */}
          {link.documents.length > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold">Documents</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {link.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <span className="text-slate-500">{d.checklistItemKey}</span>
                    <a href={fileUrl(d.fileBlobId)} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                      {d.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Verification */}
          <Card className="p-4">
            <h4 className="text-sm font-semibold">Verification</h4>
            <div className="mt-2 space-y-2">
              {checkTypes.map((t) => (
                <CheckRow key={t} type={t} check={checkByType.get(t)} linkId={link.id} onChanged={bump} />
              ))}
            </div>
          </Card>

          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}

          {/* Review actions */}
          {link.state === "PREQUAL_UNDER_REVIEW" && (
            <Card className="space-y-3 p-4">
              <h4 className="text-sm font-semibold">Review decision</h4>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  Score
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="mt-1 block w-24 rounded-lg border border-slate-300 px-3 py-1.5"
                  />
                </label>
                <Button disabled={busy} onClick={() => void act(() => reviewClear(link.id, Number(score)))}>
                  Clear
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  placeholder="Reason for reject / changes"
                  value={reason || note}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setNote(e.target.value);
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
                <Button variant="secondary" disabled={busy || !note} onClick={() => void act(() => requestChanges(link.id, note))}>
                  Request changes
                </Button>
                <Button variant="ghost" disabled={busy || !reason} onClick={() => void act(() => reviewReject(link.id, reason))}>
                  Reject
                </Button>
              </div>
            </Card>
          )}

          {/* Award */}
          {link.state === "PREQUAL_CLEARED" && (
            <div className="flex justify-end">
              <Button disabled={busy} onClick={() => void act(() => awardLink(link.id))}>
                Award this vendor
              </Button>
            </div>
          )}

          {/* Advance a reviewed full pack into approvals + contracts (owner). */}
          {link.state === "FULL_UNDER_REVIEW" && (
            <div className="flex justify-end">
              <Button disabled={busy} onClick={() => void act(() => advanceToContracts(link.id))}>
                Advance to approvals &amp; contracts
              </Button>
            </div>
          )}

          {/* Approvals — visible once awarded. */}
          {link.reviewTasks.length > 0 && (
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Approvals</h4>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    link.joinGateOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {link.joinGateOpen ? "Gate open" : "Gate closed"}
                </span>
              </div>
              <div className="space-y-2">
                {link.reviewTasks.map((t) => {
                  const mine =
                    role === t.role &&
                    APPROVER_ROLES.includes(role ?? "") &&
                    link.state === "CONTRACTS_IN_PROGRESS" &&
                    t.status !== "APPROVED";
                  // Legal can only approve once every contract is executed.
                  const allExecuted =
                    link.contracts.length > 0 && link.contracts.every((c) => c.state === "EXECUTED");
                  const approveBlocked = t.role === "LEGAL" && !allExecuted;
                  return (
                    <div key={t.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t.role}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            TASK_STATUS_STYLE[t.status] ?? "bg-slate-100 text-slate-600",
                          )}
                        >
                          {t.status.replace("_", " ").toLowerCase()}
                        </span>
                      </div>
                      {t.lastComment && <p className="mt-1 text-xs text-slate-400">“{t.lastComment}”</p>}
                      {mine && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            placeholder="Comment (required to request changes)"
                            value={approverComment}
                            onChange={(e) => setApproverComment(e.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                          />
                          <Button
                            size="sm"
                            disabled={busy || approveBlocked}
                            title={approveBlocked ? "All contracts must be executed first" : undefined}
                            onClick={() => void act(() => decideTask(t.id, "approve", approverComment || undefined))}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy || !approverComment}
                            onClick={() => void act(() => decideTask(t.id, "request_changes", approverComment))}
                          >
                            Request changes
                          </Button>
                        </div>
                      )}
                      {mine && approveBlocked && (
                        <p className="mt-1 text-xs text-amber-600">
                          Approve unlocks once all contracts are executed by both parties.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Contracts — legal (role LEGAL) can act; other buyers see read-only. */}
          {link.contracts.length > 0 && (
            <ContractsPanel
              contracts={link.contracts}
              side={role === "LEGAL" ? "LEGAL" : "READONLY"}
              onChanged={bump}
            />
          )}

          {/* ERP push / completion */}
          {(link.state === "APPROVED" ||
            link.state === "ERP_SYNCING" ||
            link.state === "ONBOARDED" ||
            link.state === "ERP_FAILED") && (
            <Card className="space-y-3 p-4">
              <h4 className="text-sm font-semibold">ERP</h4>
              {link.state === "APPROVED" && (
                <Button disabled={busy} onClick={() => void act(() => pushErp(link.id))}>
                  Push to SAP
                </Button>
              )}
              {link.state === "ERP_SYNCING" && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Spinner className="h-4 w-4" /> Creating vendor code…
                </p>
              )}
              {link.state === "ERP_FAILED" && (
                <div className="space-y-2">
                  <p className="text-sm text-rose-700">The ERP push failed.</p>
                  <Button variant="secondary" disabled={busy} onClick={() => void act(() => retryErp(link.id))}>
                    Retry push
                  </Button>
                </div>
              )}
              {link.state === "ONBOARDED" && (
                <div className="space-y-2">
                  <p className="text-sm">
                    Onboarded — vendor code{" "}
                    <span className="font-mono font-semibold">{link.erpVendorCode}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={erpPackUrl(link.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Download ERP pack
                    </a>
                    <Link
                      to="/directory"
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Directory ↗
                    </Link>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </Modal>
  );
}
