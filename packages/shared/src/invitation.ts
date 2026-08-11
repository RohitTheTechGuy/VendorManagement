import { z } from "zod";
import { requirementDetailSchema } from "./candidate.js";

// Per-candidate outcome of a dispatch.
export const inviteResultSchema = z.object({
  candidateId: z.string().uuid(),
  email: z.string(),
  // true = actually emailed via Resend; false = logged to the server console (dev / send failure).
  sent: z.boolean(),
  link: z.string(),
});
export type InviteResult = z.infer<typeof inviteResultSchema>;

export const dispatchInvitesResponseSchema = z.object({
  results: z.array(inviteResultSchema),
  requirement: requirementDetailSchema,
});
export type DispatchInvitesResponse = z.infer<typeof dispatchInvitesResponseSchema>;
