import { useState, type FormEvent } from "react";
import {
  createRequirementSchema,
  PROCESS_CATEGORIES,
  type CreateRequirementInput,
  type RequirementSummary,
} from "@vendor-management/shared";
import { createRequirement } from "../lib/requirements-api.js";
import { errorMessage } from "../lib/auth-api.js";
import { Modal } from "./Modal.js";
import { Button, cn } from "./ui.js";

const inputClass =
  "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

// Create a requirement from a slide-over on the dashboard. Modal unmounts its
// children when closed, so the form resets on each open. On success the parent
// decides where to go (currently the new requirement's detail page).
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

  function toggleProcess(p: string) {
    setProcessCategories((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
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

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create requirement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
