import { useState } from "react";
import {
  CONTRACT_STATE_LABEL,
  CONTRACT_TYPE_LABEL,
  VENDOR_TURN_CONTRACT_STATES,
  type ContractDTO,
  type ContractState,
} from "@vendor-management/shared";
import { Button, Card, cn } from "./ui.js";
import { fileUrl } from "../lib/files-api.js";
import {
  uploadDraft,
  uploadRevision,
  buyerSign,
  vendorRequestChanges,
  vendorAgree,
  vendorSign,
} from "../lib/contracts-api.js";

type Side = "LEGAL" | "VENDOR" | "READONLY";

const SIGNING_STATES: ContractState[] = ["AWAITING_SIGNATURES", "PARTIALLY_EXECUTED"];

const STATE_STYLE: Record<string, string> = {
  DRAFT_PENDING: "bg-slate-100 text-slate-600",
  DRAFT_UPLOADED: "bg-sky-50 text-sky-700",
  VENDOR_REVIEW: "bg-sky-50 text-sky-700",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-700",
  REVISED: "bg-sky-50 text-sky-700",
  AGREED: "bg-indigo-50 text-indigo-700",
  AWAITING_SIGNATURES: "bg-indigo-50 text-indigo-700",
  PARTIALLY_EXECUTED: "bg-violet-50 text-violet-700",
  EXECUTED: "bg-emerald-50 text-emerald-700",
};

function FileButton({ label, onFile, disabled }: { label: string; onFile: (f: File) => void; disabled?: boolean }) {
  return (
    <label className={cn("cursor-pointer", disabled && "pointer-events-none opacity-60")}>
      <span className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {label}
      </span>
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function ContractRow({
  contract,
  side,
  onChanged,
}: {
  contract: ContractDTO;
  side: Side;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [changeFile, setChangeFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const current = contract.versions.find((v) => v.id === contract.currentVersionId);
  const signedVersions = contract.versions.filter(
    (v) => v.kind === "VENDOR_SIGNED" || v.kind === "BUYER_SIGNED",
  );
  const vendorTurn = VENDOR_TURN_CONTRACT_STATES.includes(contract.state);
  const signing = SIGNING_STATES.includes(contract.state);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setComment("");
      onChanged();
    } catch (e) {
      setErr((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{CONTRACT_TYPE_LABEL[contract.contractType]}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATE_STYLE[contract.state])}>
          {CONTRACT_STATE_LABEL[contract.state]}
        </span>
      </div>

      {current && (
        <a
          href={fileUrl(current.fileBlobId)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline"
        >
          {current.fileName} (v{current.versionNo})
        </a>
      )}

      {signedVersions.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {signedVersions.map((v) => (
            <li key={v.id}>
              <a
                href={fileUrl(v.fileBlobId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
              >
                ✅ {v.uploadedBySide === "VENDOR" ? "Vendor-signed" : "Buyer-signed"}: {v.fileName}
              </a>
            </li>
          ))}
        </ul>
      )}

      {contract.comments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {contract.comments.map((cm) => (
            <li key={cm.id} className="text-xs text-slate-500">
              <span className="font-medium">{cm.authorSide === "VENDOR" ? "Vendor" : "Legal"}:</span> {cm.body}
              {cm.fileBlobId && (
                <>
                  {" "}
                  <a
                    href={fileUrl(cm.fileBlobId)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    📎 {cm.fileName ?? "attachment"}
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}

      {/* Legal actions */}
      {side === "LEGAL" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {contract.state === "DRAFT_PENDING" && (
            <FileButton label="Upload draft" disabled={busy} onFile={(f) => void act(() => uploadDraft(contract.id, f))} />
          )}
          {contract.state === "CHANGES_REQUESTED" && (
            <FileButton label="Upload revision" disabled={busy} onFile={(f) => void act(() => uploadRevision(contract.id, f))} />
          )}
          {signing && (
            <FileButton label="Upload buyer-signed" disabled={busy} onFile={(f) => void act(() => buyerSign(contract.id, f))} />
          )}
        </div>
      )}

      {/* Vendor actions */}
      {side === "VENDOR" && (
        <div className="mt-2 space-y-2">
          {vendorTurn && (
            <div className="space-y-2">
              <textarea
                rows={2}
                placeholder="Describe the changes you'd like — e.g. “Clause 4 liability cap is too broad, see the attached markup.”"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    {changeFile ? `📎 ${changeFile.name}` : "Attach markup (optional)"}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => setChangeFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !comment}
                  onClick={() =>
                    void act(async () => {
                      await vendorRequestChanges(contract.id, comment, changeFile ?? undefined);
                      setChangeFile(null);
                    })
                  }
                >
                  Request changes
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void act(() => vendorAgree(contract.id))}>
                  Agree
                </Button>
              </div>
            </div>
          )}
          {signing && (
            <FileButton label="Upload vendor-signed" disabled={busy} onFile={(f) => void act(() => vendorSign(contract.id, f))} />
          )}
        </div>
      )}
    </div>
  );
}

export function ContractsPanel({
  contracts,
  side,
  onChanged,
}: {
  contracts: ContractDTO[];
  side: Side;
  onChanged: () => void;
}) {
  if (contracts.length === 0) return null;
  const executed = contracts.filter((c) => c.state === "EXECUTED").length;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Contracts</h4>
        <span className="text-xs text-slate-400">{executed} / {contracts.length} executed</span>
      </div>
      <div className="space-y-2">
        {contracts.map((c) => (
          <ContractRow key={c.id} contract={c} side={side} onChanged={onChanged} />
        ))}
      </div>
    </Card>
  );
}
