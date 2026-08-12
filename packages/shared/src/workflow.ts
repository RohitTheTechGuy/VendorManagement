import { z } from "zod";
import { linkDocumentDTOSchema, LINK_STATES, LINK_STAGES } from "./link.js";
import { contractDTOSchema } from "./contract.js";

// ---------------------------------------------------------------------------
// Verification (Phases 12 + 16). Checks are mocked but deterministic per input.
// ---------------------------------------------------------------------------

export const VERIFICATION_CHECK_TYPES = ["PAN", "GST", "UDYAM", "PENNY_DROP", "GST_FILINGS"] as const;
export type VerificationCheckType = (typeof VERIFICATION_CHECK_TYPES)[number];

// Checks a buyer runs at pre-qual vs the deeper ones after the full pack.
export const PREQUAL_CHECKS: VerificationCheckType[] = ["PAN", "GST", "UDYAM"];
export const DEEP_CHECKS: VerificationCheckType[] = ["PENNY_DROP", "GST_FILINGS"];

// Clearing pre-qual is blocked until these are resolved (i.e. not FAILED/RUNNING).
export const REQUIRED_TO_CLEAR: VerificationCheckType[] = ["PAN", "GST", "UDYAM"];

// Which submission field each check reads as its subject value.
export const CHECK_SUBJECT_FIELD: Record<VerificationCheckType, string> = {
  PAN: "pan",
  GST: "gstin",
  UDYAM: "udyam",
  PENNY_DROP: "bankAccount",
  GST_FILINGS: "gstin",
};

export const CHECK_META: Record<VerificationCheckType, { label: string }> = {
  PAN: { label: "PAN verification" },
  GST: { label: "GST registration" },
  UDYAM: { label: "Udyam / MSME" },
  PENNY_DROP: { label: "Bank penny-drop" },
  GST_FILINGS: { label: "GST filings" },
};

export const VERIFICATION_STATUSES = [
  "RUNNING",
  "PASSED",
  "FAILED",
  "NEEDS_REVIEW",
  "ACCEPTED",
  "REJECTED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const verificationCheckDTOSchema = z.object({
  id: z.string().uuid(),
  checkType: z.enum(VERIFICATION_CHECK_TYPES),
  subjectValue: z.string().nullable(),
  status: z.enum(VERIFICATION_STATUSES),
  matchScore: z.number().nullable(),
  detail: z.unknown().nullable(),
  ranAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
});
export type VerificationCheckDTO = z.infer<typeof verificationCheckDTOSchema>;

// ---------------------------------------------------------------------------
// Approvals (Phase 16) and contracts (Phase 17) — summarised for the drawer.
// ---------------------------------------------------------------------------

export const reviewTaskDTOSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["QUALITY", "FINANCE", "TAX", "LEGAL"]),
  status: z.enum(["PENDING", "APPROVED", "CHANGES_REQUESTED"]),
  assignedUserEmail: z.string().nullable(),
  lastComment: z.string().nullable(),
});
export type ReviewTaskDTO = z.infer<typeof reviewTaskDTOSchema>;

// ---------------------------------------------------------------------------
// The buyer drawer: everything a buyer sees about one link.
// ---------------------------------------------------------------------------

export const buyerLinkDetailSchema = z.object({
  id: z.string().uuid(),
  state: z.enum(LINK_STATES),
  stage: z.enum(LINK_STAGES).nullable(),
  prequalScore: z.number().nullable(),
  erpVendorCode: z.string().nullable(),
  candidate: z.object({
    legalName: z.string(),
    contactEmail: z.string(),
    contactPhone: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
  }),
  requirement: z.object({
    id: z.string().uuid(),
    title: z.string(),
    processCategories: z.array(z.string()),
  }),
  fields: z.record(z.string(), z.string()),
  documents: z.array(linkDocumentDTOSchema),
  checks: z.array(verificationCheckDTOSchema),
  reviewTasks: z.array(reviewTaskDTOSchema),
  contracts: z.array(contractDTOSchema),
  joinGateOpen: z.boolean(),
});
export type BuyerLinkDetail = z.infer<typeof buyerLinkDetailSchema>;

// ---------------------------------------------------------------------------
// Buyer action request bodies.
// ---------------------------------------------------------------------------

export const verifyRequestSchema = z.object({ checkType: z.enum(VERIFICATION_CHECK_TYPES) });
export type VerifyRequestInput = z.infer<typeof verifyRequestSchema>;

export const resolveCheckSchema = z.object({ decision: z.enum(["accept", "reject"]) });
export type ResolveCheckInput = z.infer<typeof resolveCheckSchema>;

export const reviewActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("clear"), score: z.number().int().min(0).max(100) }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(1, "A reason is required") }),
]);
export type ReviewActionInput = z.infer<typeof reviewActionSchema>;

export const requestChangesSchema = z.object({
  note: z.string().trim().min(1, "A note is required"),
  documentKeys: z.array(z.string()).optional(),
});
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;

// ---------------------------------------------------------------------------
// Approver queue (Phase 16)
// ---------------------------------------------------------------------------

export const approverTaskSchema = z.object({
  id: z.string().uuid(),
  linkId: z.string().uuid(),
  role: z.enum(["QUALITY", "FINANCE", "TAX", "LEGAL"]),
  status: z.enum(["PENDING", "APPROVED", "CHANGES_REQUESTED"]),
  requirementTitle: z.string(),
  vendorName: z.string(),
  linkState: z.enum(LINK_STATES),
  lastComment: z.string().nullable(),
});
export type ApproverTask = z.infer<typeof approverTaskSchema>;

export const decideTaskSchema = z
  .object({
    decision: z.enum(["approve", "request_changes"]),
    comment: z.string().trim().optional(),
  })
  .refine((d) => d.decision === "approve" || (d.comment?.length ?? 0) > 0, {
    message: "A comment is required to request changes",
    path: ["comment"],
  });
export type DecideTaskInput = z.infer<typeof decideTaskSchema>;
