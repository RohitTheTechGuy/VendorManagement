import { z } from "zod";

// Two upload kinds with different server-enforced limits. Contracts are the
// signed legal PDFs; documents are onboarding evidence (statutory docs, certs).
export const UPLOAD_KINDS = ["document", "contract"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export const uploadKindSchema = z.enum(UPLOAD_KINDS);

export const FILE_CONSTRAINTS: Record<UploadKind, { maxBytes: number; mimeTypes: string[] }> = {
  document: { maxBytes: 5 * 1024 * 1024, mimeTypes: ["application/pdf", "image/jpeg", "image/png"] },
  contract: { maxBytes: 10 * 1024 * 1024, mimeTypes: ["application/pdf"] },
};

// Human-friendly limit labels for the UI.
export const FILE_LIMIT_LABEL: Record<UploadKind, string> = {
  document: "PDF, JPG or PNG · up to 5 MB",
  contract: "PDF · up to 10 MB",
};

// What POST /api/uploads returns — the blob id plus light metadata. The bytes
// themselves are never returned here; they are read only via GET /api/files/:id.
export const uploadResultSchema = z.object({
  fileBlobId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string(),
});
export type UploadResult = z.infer<typeof uploadResultSchema>;
