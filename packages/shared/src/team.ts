import { z } from "zod";

// Buyer roles an owner can assign to a teammate.
export const BUYER_ROLES = ["OWNER", "QUALITY", "FINANCE", "TAX", "LEGAL"] as const;
export type BuyerRole = (typeof BUYER_ROLES)[number];

// Roles that are approver seats (the four parallel reviewers).
export const APPROVER_ROLES = ["QUALITY", "FINANCE", "TAX", "LEGAL"] as const;

export const BUYER_ROLE_LABEL: Record<BuyerRole, string> = {
  OWNER: "Owner",
  QUALITY: "Quality",
  FINANCE: "Finance",
  TAX: "Tax",
  LEGAL: "Legal",
};

export const teamMemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.enum(BUYER_ROLES),
  isSelf: z.boolean(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const createTeamMemberSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  fullName: z.string().trim().min(1, "Full name is required"),
  role: z.enum(BUYER_ROLES),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
