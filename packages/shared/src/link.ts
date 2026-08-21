import { z } from "zod";
import { contractDTOSchema } from "./contract.js";
import { PROCESS_OPTIONS } from "./process.js";

// ---------------------------------------------------------------------------
// Link states + stages. These MIRROR the Prisma LinkState/LinkStage enums in
// packages/db — keep the two in sync. The server is the source of truth; these
// exist so the client can label and reason about states without importing
// Prisma.
// ---------------------------------------------------------------------------

export const LINK_STATES = [
  "INVITED",
  "PREQUAL_IN_PROGRESS",
  "PREQUAL_SUBMITTED",
  "PREQUAL_UNDER_REVIEW",
  "PREQUAL_CLEARED",
  "AWARDED",
  "FULL_IN_PROGRESS",
  "FULL_SUBMITTED",
  "FULL_UNDER_REVIEW",
  "CONTRACTS_IN_PROGRESS",
  "APPROVED",
  "ERP_SYNCING",
  "ONBOARDED",
  "REJECTED",
  "ON_HOLD",
  "WITHDRAWN",
  "ERP_FAILED",
  "EXPIRED",
] as const;
export type LinkState = (typeof LINK_STATES)[number];

export const LINK_STAGES = ["PREQUAL", "FULL"] as const;
export type LinkStage = (typeof LINK_STAGES)[number];

export type Court = "vendor" | "buyer" | "system" | "done";

// Per-state display metadata: a short label, and whose court the ball is in.
export const LINK_STATE_META: Record<LinkState, { label: string; court: Court }> = {
  INVITED: { label: "Invited", court: "vendor" },
  PREQUAL_IN_PROGRESS: { label: "Pre-qualification in progress", court: "vendor" },
  PREQUAL_SUBMITTED: { label: "Pre-qualification submitted", court: "buyer" },
  PREQUAL_UNDER_REVIEW: { label: "Under review", court: "buyer" },
  PREQUAL_CLEARED: { label: "Pre-qualified", court: "buyer" },
  AWARDED: { label: "Awarded", court: "vendor" },
  FULL_IN_PROGRESS: { label: "Full pack in progress", court: "vendor" },
  FULL_SUBMITTED: { label: "Full pack submitted", court: "buyer" },
  FULL_UNDER_REVIEW: { label: "Full pack under review", court: "buyer" },
  CONTRACTS_IN_PROGRESS: { label: "Approvals & contracts", court: "buyer" },
  APPROVED: { label: "Approved", court: "buyer" },
  ERP_SYNCING: { label: "Creating vendor code", court: "system" },
  ONBOARDED: { label: "Onboarded", court: "done" },
  REJECTED: { label: "Rejected", court: "done" },
  ON_HOLD: { label: "On hold", court: "buyer" },
  WITHDRAWN: { label: "Withdrawn", court: "done" },
  ERP_FAILED: { label: "Vendor code failed", court: "buyer" },
  EXPIRED: { label: "Invite expired", court: "done" },
};

// The ordered "rail" shown to the vendor (terminals are excluded).
export const LINK_PROGRESS_RAIL: LinkState[] = [
  "INVITED",
  "PREQUAL_IN_PROGRESS",
  "PREQUAL_SUBMITTED",
  "PREQUAL_CLEARED",
  "AWARDED",
  "FULL_SUBMITTED",
  "CONTRACTS_IN_PROGRESS",
  "APPROVED",
  "ONBOARDED",
];

// ---------------------------------------------------------------------------
// Onboarding checklists (data-driven; the server validates against these too).
// ---------------------------------------------------------------------------

export type FieldType = "text" | "email" | "tel" | "select" | "multiselect" | "number";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  pattern?: string; // JS RegExp source, validated on both sides
  placeholder?: string;
  help?: string;
}

export interface DocItemDef {
  key: string;
  label: string;
  required: boolean;
  help?: string;
}

export interface Checklist {
  fields: FieldDef[];
  documents: DocItemDef[];
}

const PAN_PATTERN = "^[A-Z]{5}[0-9]{4}[A-Z]$";
const GSTIN_PATTERN = "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$";
const UDYAM_PATTERN = "^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$";
const IFSC_PATTERN = "^[A-Z]{4}0[A-Z0-9]{6}$";

// Processes whose environmental footprint requires a pollution-control consent.
const CONSENT_PROCESSES = new Set(["HPDC", "Gravity Casting", "Plating", "Heat Treatment"]);

const PREQUAL_FIELDS: FieldDef[] = [
  {
    key: "entityType",
    label: "Entity type",
    type: "select",
    required: true,
    options: ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship"],
  },
  { key: "pan", label: "PAN", type: "text", required: true, pattern: PAN_PATTERN, placeholder: "AAACC1234A" },
  { key: "gstin", label: "GSTIN", type: "text", required: true, pattern: GSTIN_PATTERN, placeholder: "27AAACC1234A1Z5" },
  { key: "udyam", label: "Udyam registration", type: "text", required: false, pattern: UDYAM_PATTERN, placeholder: "UDYAM-MH-00-0000000" },
  { key: "contactName", label: "Primary contact name", type: "text", required: true },
  { key: "contactEmail", label: "Primary contact email", type: "email", required: true },
  { key: "contactPhone", label: "Primary contact phone", type: "tel", required: false },
  { key: "processes", label: "Manufacturing processes", type: "multiselect", required: true, options: PROCESS_OPTIONS },
  { key: "annualCapacity", label: "Annual capacity (units/yr)", type: "number", required: false },
];

const FULL_FIELDS: FieldDef[] = [
  { key: "bankBeneficiary", label: "Bank account name", type: "text", required: true },
  { key: "bankAccount", label: "Bank account number", type: "text", required: true, pattern: "^[0-9]{6,18}$" },
  { key: "bankIFSC", label: "IFSC code", type: "text", required: true, pattern: IFSC_PATTERN, placeholder: "HDFC0001234" },
  { key: "msmeCategory", label: "MSME category", type: "select", required: false, options: ["Micro", "Small", "Medium", "Not registered"] },
];

/** Fields + documents for a stage, given the requirement's process categories. */
export function checklistFor(stage: LinkStage, processCategories: string[]): Checklist {
  const needsConsent = processCategories.some((p) => CONSENT_PROCESSES.has(p));

  if (stage === "PREQUAL") {
    const documents: DocItemDef[] = [
      { key: "pan_card", label: "PAN card", required: true },
      { key: "gst_certificate", label: "GST registration certificate", required: true },
      { key: "udyam_certificate", label: "Udyam / MSME certificate", required: false },
      { key: "quality_certificate", label: "Quality certificate (ISO / IATF)", required: false },
    ];
    if (needsConsent) {
      documents.push({
        key: "pollution_consent",
        label: "Pollution control board consent",
        required: true,
        help: "Required for casting, plating and heat-treatment processes.",
      });
    }
    return { fields: PREQUAL_FIELDS, documents };
  }

  // FULL
  return {
    fields: FULL_FIELDS,
    documents: [
      { key: "cancelled_cheque", label: "Cancelled cheque", required: true },
      { key: "bank_statement", label: "Recent bank statement", required: false },
      { key: "iso_certificate", label: "ISO / IATF certificate", required: true },
      { key: "financials", label: "Audited financials (last year)", required: false },
    ],
  };
}

// ---------------------------------------------------------------------------
// API request/response schemas (Phase 11 + 14)
// ---------------------------------------------------------------------------

export const redeemInviteSchema = z.object({ token: z.string().min(1) });
export type RedeemInviteInput = z.infer<typeof redeemInviteSchema>;

export const setVendorPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type SetVendorPasswordInput = z.infer<typeof setVendorPasswordSchema>;

export const saveFieldsSchema = z.object({
  fields: z.record(z.string(), z.string()),
});
export type SaveFieldsInput = z.infer<typeof saveFieldsSchema>;

export const attachDocumentSchema = z.object({
  checklistItemKey: z.string().min(1),
  fileBlobId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
});
export type AttachDocumentInput = z.infer<typeof attachDocumentSchema>;

// The DTOs the vendor portal reads. Blob bytes never appear here — only ids.
export const linkDocumentDTOSchema = z.object({
  id: z.string().uuid(),
  checklistItemKey: z.string(),
  fileBlobId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  status: z.string(),
  rejectionReason: z.string().nullable(),
  uploadedAt: z.string(),
});
export type LinkDocumentDTO = z.infer<typeof linkDocumentDTOSchema>;

export const tatSchema = z.object({
  vendorPendingDays: z.number(),
  buyerPendingDays: z.number(),
});
export type Tat = z.infer<typeof tatSchema>;

export const vendorLinkDTOSchema = z.object({
  id: z.string().uuid(),
  state: z.enum(LINK_STATES),
  stage: z.enum(LINK_STAGES).nullable(),
  requirement: z.object({
    id: z.string().uuid(),
    title: z.string(),
    processCategories: z.array(z.string()),
    buyerOrgName: z.string(),
  }),
  buyerContact: z.object({ name: z.string().nullable(), email: z.string() }).nullable(),
  fields: z.record(z.string(), z.string()),
  documents: z.array(linkDocumentDTOSchema),
  contracts: z.array(contractDTOSchema),
  prequalScore: z.number().nullable(),
  erpVendorCode: z.string().nullable(),
  tat: tatSchema,
  createdAt: z.string(),
});
export type VendorLinkDTO = z.infer<typeof vendorLinkDTOSchema>;

export const vendorLinkSummarySchema = z.object({
  id: z.string().uuid(),
  state: z.enum(LINK_STATES),
  stage: z.enum(LINK_STAGES).nullable(),
  requirementTitle: z.string(),
});
export type VendorLinkSummary = z.infer<typeof vendorLinkSummarySchema>;

export const redeemResultSchema = z.object({
  needsPassword: z.boolean(),
  linkId: z.string().uuid(),
  requirementTitle: z.string(),
  email: z.string().email(),
});
export type RedeemResult = z.infer<typeof redeemResultSchema>;
