import { useEffect, useMemo, useRef, useState } from "react";
import {
  checklistFor,
  type FieldDef,
  type VendorLinkDTO,
} from "@vendor-management/shared";
import { attachDocument, deleteDocument, saveFields, submitErrors, submitLink } from "../lib/vendor-api.js";
import { uploadFile, fileUrl } from "../lib/files-api.js";
import { Button, Card, cn } from "./ui.js";

const SPLIT = "|"; // multiselect values are stored joined by this

function FieldInput({
  field,
  value,
  onChange,
  invalid,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  const base = cn(
    "mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:border-indigo-500",
    invalid ? "border-rose-400" : "border-slate-300",
  );

  if (field.type === "select") {
    return (
      <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "multiselect") {
    const selected = new Set(value ? value.split(SPLIT) : []);
    return (
      <div className="mt-1 flex flex-wrap gap-2">
        {field.options?.map((o) => {
          const on = selected.has(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => {
                const next = new Set(selected);
                if (on) next.delete(o);
                else next.add(o);
                onChange([...next].join(SPLIT));
              }}
              className={cn(
                "rounded-full px-3 py-1 text-sm ring-1 ring-inset transition",
                on
                  ? "bg-indigo-600 text-white ring-indigo-600"
                  : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : field.type}
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={base}
    />
  );
}

export function OnboardingForm({
  link,
  reload,
  onSubmitted,
}: {
  link: VendorLinkDTO;
  reload: () => void;
  onSubmitted: (dto: VendorLinkDTO) => void;
}) {
  const checklist = useMemo(
    () => checklistFor(link.stage ?? "PREQUAL", link.requirement.processCategories),
    [link.stage, link.requirement.processCategories],
  );

  const [values, setValues] = useState<Record<string, string>>(link.fields);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local field state in step if the link reloads (e.g. after re-open).
  useEffect(() => {
    setValues(link.fields);
  }, [link.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function onField(key: string, v: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: v };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setSaving(true);
        void saveFields(link.id, next).finally(() => setSaving(false));
      }, 700);
      return next;
    });
  }

  async function onPickFile(checklistItemKey: string, file: File | undefined) {
    if (!file) return;
    setUploadingKey(checklistItemKey);
    try {
      const uploaded = await uploadFile(file, "document");
      await attachDocument(link.id, {
        checklistItemKey,
        fileBlobId: uploaded.fileBlobId,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
      });
      reload();
    } catch (error) {
      const data = (error as { response?: { data?: { error?: string } } }).response?.data;
      setErrors([data?.error ?? "Upload failed. Check the file type and size."]);
    } finally {
      setUploadingKey(null);
    }
  }

  async function onSubmit() {
    setSubmitting(true);
    setErrors([]);
    try {
      // Flush any pending autosave first.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await saveFields(link.id, values);
      const dto = await submitLink(link.id);
      onSubmitted(dto);
    } catch (error) {
      const list = submitErrors(error);
      setErrors(list ?? ["Could not submit. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  const docByKey = new Map(link.documents.map((d) => [d.checklistItemKey, d]));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Company details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {checklist.fields.map((field) => (
            <label
              key={field.key}
              className={cn("block text-sm font-medium", field.type === "multiselect" && "sm:col-span-2")}
            >
              {field.label}
              {field.required && <span className="text-rose-500"> *</span>}
              <FieldInput
                field={field}
                value={values[field.key] ?? ""}
                onChange={(v) => onField(field.key, v)}
                invalid={false}
              />
              {field.help && <span className="mt-1 block text-xs text-slate-400">{field.help}</span>}
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Documents</h2>
        <div className="mt-4 space-y-3">
          {checklist.documents.map((item) => {
            const doc = docByKey.get(item.key);
            return (
              <div
                key={item.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.label}
                    {item.required && <span className="text-rose-500"> *</span>}
                  </p>
                  {item.help && <p className="text-xs text-slate-400">{item.help}</p>}
                  {doc && (
                    <a
                      href={fileUrl(doc.fileBlobId)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      {doc.fileName}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {doc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void deleteDocument(link.id, doc.id).then(reload)}
                    >
                      Remove
                    </Button>
                  )}
                  <label className="cursor-pointer">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50",
                        uploadingKey === item.key && "opacity-60",
                      )}
                    >
                      {uploadingKey === item.key ? "Uploading…" : doc ? "Replace" : "Upload"}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={(e) => void onPickFile(item.key, e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {errors.length > 0 && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <ul className="list-inside list-disc space-y-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-slate-400">{saving ? "Saving…" : "All changes saved"}</span>
        <Button onClick={() => void onSubmit()} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for review"}
        </Button>
      </div>
    </div>
  );
}
