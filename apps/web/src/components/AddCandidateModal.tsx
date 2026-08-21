import { useEffect, useState, type FormEvent } from "react";
import {
  addCandidateSchema,
  PAN_REGEX,
  GSTIN_REGEX,
  PROCESS_OPTIONS,
  type AddCandidateInput,
  type DirectoryVendor,
  type RequirementDetail,
} from "@vendor-management/shared";
import { addCandidates, getDirectory } from "../lib/candidates-api.js";
import { errorMessage } from "../lib/auth-api.js";
import { Modal } from "./Modal.js";
import { Button, cn } from "./ui.js";

const STATE_OPTIONS = ["Maharashtra", "Tamil Nadu", "Haryana", "Gujarat", "Punjab"];

const inputClass =
  "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

export function AddCandidateModal({
  open,
  onClose,
  requirementId,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  requirementId: string;
  onUpdated: (detail: RequirementDetail) => void;
}) {
  const [tab, setTab] = useState<"directory" | "manual">("directory");

  return (
    <Modal open={open} onClose={onClose} title="Add candidate" maxWidth="max-w-2xl">
      <div className="mb-5 inline-flex rounded-lg bg-muted p-1 text-sm">
        <TabButton active={tab === "directory"} onClick={() => setTab("directory")}>
          From directory
        </TabButton>
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")}>
          Add manually
        </TabButton>
      </div>

      {tab === "directory" ? (
        <DirectoryTab requirementId={requirementId} onUpdated={onUpdated} onClose={onClose} />
      ) : (
        <ManualTab requirementId={requirementId} onUpdated={onUpdated} onClose={onClose} />
      )}
    </Modal>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function DirectoryTab({
  requirementId,
  onUpdated,
  onClose,
}: {
  requirementId: string;
  onUpdated: (detail: RequirementDetail) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [process, setProcess] = useState("");
  const [state, setState] = useState("");
  const [vendors, setVendors] = useState<DirectoryVendor[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVendors(null);
    setLoadError(null);
    const timer = setTimeout(() => {
      getDirectory({
        requirementId,
        search: search || undefined,
        process: process || undefined,
        state: state || undefined,
      })
        .then((v) => !cancelled && setVendors(v))
        .catch((e) => !cancelled && setLoadError(errorMessage(e, "Could not load the directory.")));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [requirementId, search, process, state]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const items: AddCandidateInput[] = [...selected].map((id) => ({ source: "directory", directoryVendorId: id }));
      const detail = await addCandidates(requirementId, items);
      onUpdated(detail);
      onClose();
    } catch (e) {
      setSubmitError(errorMessage(e, "Could not add the selected vendors."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors…"
          className="min-w-[12rem] flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <select value={process} onChange={(e) => setProcess(e.target.value)} className="rounded-lg border border-border px-2 py-2 text-sm">
          <option value="">All processes</option>
          {PROCESS_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} className="rounded-lg border border-border px-2 py-2 text-sm">
          <option value="">All states</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-border">
        {vendors === null && !loadError && <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>}
        {loadError && <p className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">{loadError}</p>}
        {vendors && vendors.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No matching vendors (or all already added).</p>
        )}
        {vendors?.map((v) => {
          const isSelected = selected.has(v.id);
          return (
            <button
              type="button"
              key={v.id}
              onClick={() => toggle(v.id)}
              className={cn(
                "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted",
                isSelected && "bg-accent",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded border",
                  isSelected ? "border-primary bg-primary text-white" : "border-border",
                )}
              >
                {isSelected && (
                  <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                    <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{v.legalName}</span>
                  {v.badgeState === "VERIFIED" && (
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                      Verified
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[v.city, v.state].filter(Boolean).join(", ")} · {v.processTags.slice(0, 3).join(", ")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {submitError && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{submitError}</p>}

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{selected.size} selected</span>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={addSelected} disabled={selected.size === 0 || submitting}>
            {submitting ? "Adding…" : `Add selected`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ManualTab({
  requirementId,
  onUpdated,
  onClose,
}: {
  requirementId: string;
  onUpdated: (detail: RequirementDetail) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    legalName: "",
    contactEmail: "",
    contactPhone: "",
    pan: "",
    gstin: "",
    city: "",
    state: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  }

  // Inline format hints — only when the optional field has a value.
  const panInvalid = form.pan.trim() !== "" && !PAN_REGEX.test(form.pan.trim().toUpperCase());
  const gstinInvalid = form.gstin.trim() !== "" && !GSTIN_REGEX.test(form.gstin.trim().toUpperCase());

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const payload: AddCandidateInput = {
      source: "manual",
      legalName: form.legalName,
      contactEmail: form.contactEmail,
      ...(form.contactPhone.trim() && { contactPhone: form.contactPhone.trim() }),
      ...(form.pan.trim() && { pan: form.pan.trim() }),
      ...(form.gstin.trim() && { gstin: form.gstin.trim() }),
      ...(form.city.trim() && { city: form.city.trim() }),
      ...(form.state.trim() && { state: form.state.trim() }),
    };

    const parsed = addCandidateSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const detail = await addCandidates(requirementId, [parsed.data]);
      onUpdated(detail);
      onClose();
    } catch (e) {
      setFormError(errorMessage(e, "Could not add the candidate."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {formError && <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{formError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium sm:col-span-2">
          Vendor name <span className="text-rose-500 dark:text-rose-400">*</span>
          <input value={form.legalName} onChange={set("legalName")} className={inputClass} />
          {fieldErrors.legalName && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.legalName[0]}</span>}
        </label>

        <label className="block text-sm font-medium">
          Contact email <span className="text-rose-500 dark:text-rose-400">*</span>
          <input type="email" value={form.contactEmail} onChange={set("contactEmail")} className={inputClass} />
          {fieldErrors.contactEmail && (
            <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.contactEmail[0]}</span>
          )}
        </label>

        <label className="block text-sm font-medium">
          Phone
          <input value={form.contactPhone} onChange={set("contactPhone")} className={inputClass} />
        </label>

        <label className="block text-sm font-medium">
          PAN
          <input value={form.pan} onChange={set("pan")} placeholder="AAAAA9999A" className={inputClass} />
          {panInvalid && <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">Format looks off (AAAAA9999A)</span>}
        </label>

        <label className="block text-sm font-medium">
          GSTIN
          <input value={form.gstin} onChange={set("gstin")} placeholder="22AAAAA0000A1Z5" className={inputClass} />
          {gstinInvalid && <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">Format looks off</span>}
        </label>

        <label className="block text-sm font-medium">
          City
          <input value={form.city} onChange={set("city")} className={inputClass} />
        </label>

        <label className="block text-sm font-medium">
          State
          <input value={form.state} onChange={set("state")} className={inputClass} />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add candidate"}
        </Button>
      </div>
    </form>
  );
}
