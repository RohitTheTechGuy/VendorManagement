import { z } from "zod";
import {
  redeemResultSchema,
  vendorLinkDTOSchema,
  vendorLinkSummarySchema,
  type RedeemResult,
  type VendorLinkDTO,
  type VendorLinkSummary,
} from "@vendor-management/shared";
import { http } from "./http.js";

export async function redeemInvite(token: string): Promise<RedeemResult> {
  const res = await http.post("/api/invite/redeem", { token });
  return redeemResultSchema.parse(res.data);
}

export async function setVendorPassword(password: string): Promise<void> {
  await http.post("/api/invite/set-password", { password });
}

export async function listMyLinks(): Promise<VendorLinkSummary[]> {
  const res = await http.get("/api/links");
  return z.array(vendorLinkSummarySchema).parse(res.data);
}

export async function getLink(id: string): Promise<VendorLinkDTO> {
  const res = await http.get(`/api/links/${id}`);
  return vendorLinkDTOSchema.parse(res.data);
}

export async function saveFields(id: string, fields: Record<string, string>): Promise<void> {
  await http.put(`/api/links/${id}/fields`, { fields });
}

export async function attachDocument(
  id: string,
  input: { checklistItemKey: string; fileBlobId: string; fileName: string; mimeType: string; sizeBytes: number },
): Promise<void> {
  await http.post(`/api/links/${id}/documents`, input);
}

export async function deleteDocument(id: string, docId: string): Promise<void> {
  await http.delete(`/api/links/${id}/documents/${docId}`);
}

const submitErrorSchema = z.object({ error: z.string(), errors: z.array(z.string()).optional() });

export async function submitLink(id: string): Promise<VendorLinkDTO> {
  const res = await http.post(`/api/links/${id}/submit`);
  return vendorLinkDTOSchema.parse(res.data);
}

// Pull the list of specific validation errors out of a 422 response.
export function submitErrors(error: unknown): string[] | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object"
  ) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    const parsed = submitErrorSchema.safeParse(data);
    if (parsed.success && parsed.data.errors) return parsed.data.errors;
  }
  return null;
}
