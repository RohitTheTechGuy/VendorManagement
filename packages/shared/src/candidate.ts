import { z } from "zod";
import { requirementStageSchema } from "./requirement.js";

export const candidateSourceSchema = z.enum(["MANUAL", "DIRECTORY"]);
export type CandidateSource = z.infer<typeof candidateSourceSchema>;

export const inviteStatusSchema = z.enum(["NOT_INVITED", "INVITED", "OPENED", "EXPIRED"]);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

// Indian PAN and GSTIN formats — validated only when a value is provided.
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;

const panField = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => PAN_REGEX.test(v), "PAN must look like AAAAA9999A")
  .optional();

const gstinField = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => GSTIN_REGEX.test(v), "Invalid GSTIN format")
  .optional();

// A candidate's engagement, once it has redeemed its invite (else null).
export const candidateLinkSchema = z.object({
  id: z.string().uuid(),
  state: z.string(),
  prequalScore: z.number().nullable(),
});
export type CandidateLink = z.infer<typeof candidateLinkSchema>;

export const candidateSchema = z.object({
  id: z.string().uuid(),
  requirementId: z.string().uuid(),
  source: candidateSourceSchema,
  directoryVendorId: z.string().uuid().nullable(),
  legalName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string().nullable(),
  pan: z.string().nullable(),
  gstin: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  inviteStatus: inviteStatusSchema,
  link: candidateLinkSchema.nullable().optional(),
  createdAt: z.string(),
});
export type Candidate = z.infer<typeof candidateSchema>;

// Adding a candidate — a discriminated union on `source`.
export const addCandidateSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("manual"),
    legalName: z.string().trim().min(1, "Name is required"),
    contactEmail: z.string().trim().email("Valid email is required"),
    contactPhone: z.string().trim().optional(),
    pan: panField,
    gstin: gstinField,
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
  }),
  z.object({
    source: z.literal("directory"),
    directoryVendorId: z.string().uuid(),
  }),
]);
export type AddCandidateInput = z.infer<typeof addCandidateSchema>;

export const addCandidatesSchema = z.object({
  candidates: z.array(addCandidateSchema).min(1),
});
export type AddCandidatesInput = z.infer<typeof addCandidatesSchema>;

// Full requirement detail (requirement + its candidates).
export const requirementDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  partCategory: z.string().nullable(),
  processCategories: z.array(z.string()),
  plantLocation: z.string().nullable(),
  targetAwardDate: z.string().nullable(),
  stage: requirementStageSchema,
  createdAt: z.string(),
  candidates: z.array(candidateSchema),
});
export type RequirementDetail = z.infer<typeof requirementDetailSchema>;

export const requirementDetailResponseSchema = z.object({
  requirement: requirementDetailSchema,
});
export type RequirementDetailResponse = z.infer<typeof requirementDetailResponseSchema>;
