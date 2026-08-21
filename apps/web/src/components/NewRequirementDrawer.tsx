import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createRequirementSchema,
  PROCESS_CATEGORIES,
  type AddCandidateInput,
  type CreateRequirementInput,
  type DirectoryVendor,
  type RequirementSummary,
} from "@vendor-management/shared";
import { createRequirement } from "../lib/requirements-api.js";
import { addCandidates, getDirectory } from "../lib/candidates-api.js";
import { matchVendors } from "../lib/vendor-match.js";
import { errorMessage } from "../lib/auth-api.js";
import { Modal } from "./Modal.js";
import { Button, Spinner, cn } from "./ui.js";

const inputClass =
  "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

const BADGE_STYLE: Record<string, string> = {
  VERIFIED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  LISTED: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  STALE: "bg-muted text-muted-foreground",
};

// Create a requirement from a slide-over on the dashboard, and — the payoff of
// this feature — shortlist matching directory vendors in the same flow. Modal
// unmounts its children when closed, so all state resets on each open.
export function NewRequirementDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (requirement: RequirementSummary) => void;
}) {
  const [title, setTitle] = useState("");
  const [partCategory, setPartCategory] = useState("");
  const [processCategories, setProcessCategories] = useState<string[]>([]);
  const [plantLocation, setPlantLocation] = useState("");
  const [targetAwardDate, setTargetAwardDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [directory, setDirectory] = useState<DirectoryVendor[] | null>(null);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Load the directory once when the drawer opens; matching is then client-side.
  useEffect(() => {
    let cancelled = false;
    getDirectory({})
      .then((v) => !cancelled && setDirectory(v))
      .catch(() => !cancelled && setDirectory([]))
      .finally(() => !cancelled && setLoadingVendors(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(
    () => (directory ? matchVendors(directory, { processCategories, location: plantLocation }) : []),
    [directory, processCategories, plantLocation],
  );
  const matchedIds = useMemo(() => new Set(matches.map((m) => m.vendor.id)), [matches]);

  // Keep the selection to vendors still on the match list (e.g. after a process
  // is removed), so we never silently add a vendor the buyer can no longer see.
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => matchedIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [matchedIds]);

  function toggleProcess(p: string) {
    setProcessCategories((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Build the payload, omitting empty optionals (targetAwardDate must be a valid date or absent).
    const payload: CreateRequirementInput = { title, processCategories };
    if (partCategory.trim()) payload.partCategory = partCategory.trim();
    if (plantLocation.trim()) payload.plantLocation = plantLocation.trim();
    if (targetAwardDate) payload.targetAwardDate = targetAwardDate;

    const parsed = createRequirementSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await createRequirement(parsed.data);
      if (selectedIds.length > 0) {
        const candidates: AddCandidateInput[] = selectedIds.map((directoryVendorId) => ({
          source: "directory",
          directoryVendorId,
        }));
        // Best-effort: the requirement exists either way, so a candidate-add
        // failure shouldn't trap the buyer — they can still add vendors on the
        // detail page we're about to land on.
        try {
          await addCandidates(created.id, candidates);
        } catch {
          /* handled by landing on the detail page */
        }
      }
      onCreated(created);
    } catch (error) {
      setFormError(errorMessage(error, "Could not create the requirement. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New requirement" maxWidth="max-w-2xl">
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">Define the part and process, then shortlist vendors.</p>
      <form onSubmit={onSubmit}>
        {formError && (
          <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{formError}</p>
        )}

        <label className="block text-sm font-medium">
          Title <span className="text-rose-500 dark:text-rose-400">*</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Forged steering knuckles"
            className={inputClass}
          />
          {fieldErrors.title && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{fieldErrors.title[0]}</span>}
        </label>

        <label className="mt-4 block text-sm font-medium">
          Part category
          <input
            value={partCategory}
            onChange={(e) => setPartCategory(e.target.value)}
            placeholder="e.g. Casting"
            className={inputClass}
          />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Process categories</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROCESS_CATEGORIES.map((p) => {
              const active = processCategories.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProcess(p)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Plant location
            <input
              value={plantLocation}
              onChange={(e) => setPlantLocation(e.target.value)}
              placeholder="e.g. Manesar Plant 1"
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium">
            Target award date
            <input
              type="date"
              value={targetAwardDate}
              onChange={(e) => setTargetAwardDate(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        {/* Matching vendors — shortlist candidates from the directory in-flow. */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Matching vendors{matches.length > 0 ? ` (${matches.length})` : ""}
            </h3>
            {selectedIds.length > 0 && (
              <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
            )}
          </div>

          {processCategories.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Pick a process to see matching vendors from your directory.
            </p>
          ) : loadingVendors ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="h-4 w-4" /> Finding vendors…
            </div>
          ) : matches.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No matching vendors in your directory yet — you can add vendors manually on the detail page.
            </p>
          ) : (
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
              {matches.map(({ vendor, sharedProcesses }) => (
                <li key={vendor.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(vendor.id)}
                      onChange={() => toggleSelected(vendor.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{vendor.legalName}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            BADGE_STYLE[vendor.badgeState] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {vendor.badgeState}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[vendor.city, vendor.state].filter(Boolean).join(", ")}
                        {sharedProcesses.length > 0 && ` · ${sharedProcesses.join(", ")}`}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Creating…"
              : selectedIds.length > 0
                ? `Create with ${selectedIds.length} vendor${selectedIds.length === 1 ? "" : "s"}`
                : "Create requirement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
