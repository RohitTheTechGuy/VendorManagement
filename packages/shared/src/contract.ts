import { z } from "zod";

// Self-contained contract vocabulary (no imports from link/workflow, so both
// can depend on this without a cycle).

export const CONTRACT_TYPES = [
  "NDA",
  "MSA",
  "QUALITY_AGREEMENT",
  "SUPPLY_AGREEMENT",
  "PRICING_AGREEMENT",
  "DATA_PROCESSING",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_STATES = [
  "DRAFT_PENDING",
  "DRAFT_UPLOADED",
  "VENDOR_REVIEW",
  "CHANGES_REQUESTED",
  "REVISED",
  "AGREED",
  "AWAITING_SIGNATURES",
  "PARTIALLY_EXECUTED",
  "EXECUTED",
] as const;
export type ContractState = (typeof CONTRACT_STATES)[number];

// Which contract states are the vendor's turn to act.
export const VENDOR_TURN_CONTRACT_STATES: ContractState[] = ["DRAFT_UPLOADED", "REVISED", "VENDOR_REVIEW"];

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  NDA: "Non-disclosure agreement",
  MSA: "Master service agreement",
  QUALITY_AGREEMENT: "Quality agreement",
  SUPPLY_AGREEMENT: "Supply agreement",
  PRICING_AGREEMENT: "Pricing agreement",
  DATA_PROCESSING: "Data processing agreement",
};

export const CONTRACT_STATE_LABEL: Record<ContractState, string> = {
  DRAFT_PENDING: "Awaiting legal draft",
  DRAFT_UPLOADED: "Draft sent to vendor",
  VENDOR_REVIEW: "Vendor reviewing",
  CHANGES_REQUESTED: "Changes requested",
  REVISED: "Revised draft sent",
  AGREED: "Agreed — awaiting signatures",
  AWAITING_SIGNATURES: "Awaiting signatures",
  PARTIALLY_EXECUTED: "Partially executed",
  EXECUTED: "Executed",
};

export const contractVersionDTOSchema = z.object({
  id: z.string().uuid(),
  versionNo: z.number().int(),
  kind: z.enum(["DRAFT", "REVISED", "VENDOR_SIGNED", "BUYER_SIGNED"]),
  uploadedBySide: z.enum(["VENDOR", "BUYER"]),
  fileBlobId: z.string().uuid(),
  fileName: z.string(),
  createdAt: z.string(),
});
export type ContractVersionDTO = z.infer<typeof contractVersionDTOSchema>;

export const contractCommentDTOSchema = z.object({
  id: z.string().uuid(),
  authorSide: z.enum(["VENDOR", "BUYER"]),
  body: z.string(),
  createdAt: z.string(),
});
export type ContractCommentDTO = z.infer<typeof contractCommentDTOSchema>;

export const contractDTOSchema = z.object({
  id: z.string().uuid(),
  contractType: z.enum(CONTRACT_TYPES),
  state: z.enum(CONTRACT_STATES),
  currentVersionId: z.string().uuid().nullable(),
  versions: z.array(contractVersionDTOSchema),
  comments: z.array(contractCommentDTOSchema),
});
export type ContractDTO = z.infer<typeof contractDTOSchema>;

// Action bodies
export const contractUploadSchema = z.object({
  fileBlobId: z.string().uuid(),
  fileName: z.string().min(1),
});
export type ContractUploadInput = z.infer<typeof contractUploadSchema>;

export const contractCommentInputSchema = z.object({
  comment: z.string().trim().min(1, "A comment is required"),
});
export type ContractCommentInput = z.infer<typeof contractCommentInputSchema>;
