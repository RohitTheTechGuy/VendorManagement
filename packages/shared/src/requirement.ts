import { z } from "zod";

export const requirementStageSchema = z.enum([
  "DRAFT",
  "CANDIDATES_SELECTED",
  "INVITES_SENT",
  "IN_PROGRESS",
  "CLOSED",
]);
export type RequirementStage = z.infer<typeof requirementStageSchema>;

// Summary shown on the dashboard (dates serialised as ISO strings).
export const requirementSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  partCategory: z.string().nullable(),
  processCategories: z.array(z.string()),
  plantLocation: z.string().nullable(),
  targetAwardDate: z.string().nullable(),
  stage: requirementStageSchema,
  candidateCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type RequirementSummary = z.infer<typeof requirementSummarySchema>;

export const requirementListResponseSchema = z.object({
  requirements: z.array(requirementSummarySchema),
});
export type RequirementListResponse = z.infer<typeof requirementListResponseSchema>;

// Preset process categories offered in the create form (multi-select chips).
export const PROCESS_CATEGORIES = ["Machining", "Casting", "Forging", "Plating", "Assembly"] as const;

export const createRequirementSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  partCategory: z.string().trim().max(80).optional(),
  processCategories: z.array(z.string()).default([]),
  plantLocation: z.string().trim().max(120).optional(),
  // ISO date (YYYY-MM-DD) from the date input, or omitted.
  targetAwardDate: z.string().date().optional(),
});
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;

export const requirementResponseSchema = z.object({
  requirement: requirementSummarySchema,
});
export type RequirementResponse = z.infer<typeof requirementResponseSchema>;
