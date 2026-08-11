import { z } from "zod";

export const badgeStateSchema = z.enum(["VERIFIED", "LISTED", "STALE"]);
export type BadgeState = z.infer<typeof badgeStateSchema>;

export const directoryVendorSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
  pan: z.string().nullable(),
  primaryGstin: z.string().nullable(),
  contactEmail: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  processTags: z.array(z.string()),
  certificationTags: z.array(z.string()),
  badgeState: badgeStateSchema,
});
export type DirectoryVendor = z.infer<typeof directoryVendorSchema>;

export const directoryListResponseSchema = z.object({
  vendors: z.array(directoryVendorSchema),
});
export type DirectoryListResponse = z.infer<typeof directoryListResponseSchema>;

export const directoryQuerySchema = z.object({
  search: z.string().optional(),
  process: z.string().optional(),
  state: z.string().optional(),
  // Exclude vendors already added as candidates on this requirement.
  requirementId: z.string().uuid().optional(),
});
export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;
