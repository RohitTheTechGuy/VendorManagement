import {
  buyerLinkDetailSchema,
  type BuyerLinkDetail,
  type VerificationCheckType,
} from "@vendor-management/shared";
import { http } from "./http.js";

export async function getBuyerLink(id: string): Promise<BuyerLinkDetail> {
  const res = await http.get(`/api/buyer/links/${id}`);
  return buyerLinkDetailSchema.parse(res.data);
}

export async function runCheck(id: string, checkType: VerificationCheckType): Promise<void> {
  await http.post(`/api/buyer/links/${id}/verify`, { checkType });
}

export async function resolveCheck(id: string, checkId: string, decision: "accept" | "reject"): Promise<void> {
  await http.post(`/api/buyer/links/${id}/checks/${checkId}/resolve`, { decision });
}

export async function requestChanges(id: string, note: string, documentKeys?: string[]): Promise<BuyerLinkDetail> {
  const res = await http.post(`/api/buyer/links/${id}/request-changes`, { note, documentKeys });
  return buyerLinkDetailSchema.parse(res.data);
}

export async function reviewClear(id: string, score: number): Promise<BuyerLinkDetail> {
  const res = await http.post(`/api/buyer/links/${id}/review`, { action: "clear", score });
  return buyerLinkDetailSchema.parse(res.data);
}

export async function reviewReject(id: string, reason: string): Promise<BuyerLinkDetail> {
  const res = await http.post(`/api/buyer/links/${id}/review`, { action: "reject", reason });
  return buyerLinkDetailSchema.parse(res.data);
}

export async function awardLink(id: string): Promise<BuyerLinkDetail> {
  const res = await http.post(`/api/buyer/links/${id}/award`);
  return buyerLinkDetailSchema.parse(res.data);
}

export async function advanceToContracts(id: string): Promise<BuyerLinkDetail> {
  const res = await http.post(`/api/buyer/links/${id}/advance-to-contracts`);
  return buyerLinkDetailSchema.parse(res.data);
}

export async function pushErp(id: string): Promise<BuyerLinkDetail> {
  const res = await http.post(`/api/buyer/links/${id}/push-erp`);
  return buyerLinkDetailSchema.parse(res.data);
}

export async function retryErp(id: string): Promise<BuyerLinkDetail> {
  const res = await http.post(`/api/buyer/links/${id}/retry-erp`);
  return buyerLinkDetailSchema.parse(res.data);
}

export function erpPackUrl(id: string): string {
  return (import.meta.env.VITE_API_URL ?? "") + `/api/buyer/links/${id}/erp-pack`;
}
