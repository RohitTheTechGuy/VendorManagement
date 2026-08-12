import { z } from "zod";

// A single entry in the buyer-side activity feed. Merged from several sources
// (state transitions, approvals, contract uploads/signatures, verifications).
export const activityItemSchema = z.object({
  id: z.string(),
  at: z.string(),
  side: z.enum(["vendor", "buyer", "system"]),
  category: z.enum(["lifecycle", "approval", "contract", "verification"]),
  vendorName: z.string(),
  requirementTitle: z.string(),
  description: z.string(),
});
export type ActivityItem = z.infer<typeof activityItemSchema>;
