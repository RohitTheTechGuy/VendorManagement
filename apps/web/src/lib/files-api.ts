import { uploadResultSchema, type UploadKind, type UploadResult } from "@vendor-management/shared";
import { http } from "./http.js";

// Upload a single file as multipart. The browser sets the multipart boundary
// automatically when we pass a FormData body.
export async function uploadFile(file: File, kind: UploadKind): Promise<UploadResult> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const response = await http.post("/api/uploads", form);
  return uploadResultSchema.parse(response.data);
}

// URL for viewing/downloading a stored blob. Append ?download=1 to force a save.
export function fileUrl(fileBlobId: string, download = false): string {
  const base = (import.meta.env.VITE_API_URL ?? "") + `/api/files/${fileBlobId}`;
  return download ? `${base}?download=1` : base;
}
