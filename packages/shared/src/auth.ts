import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1, "Full name is required"),
  orgName: z.string().min(1, "Organisation name is required"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const userTypeSchema = z.enum(["BUYER", "VENDOR"]);
export type UserType = z.infer<typeof userTypeSchema>;

// The client-safe view of a user — never includes the password hash.
// Vendors have a null orgId and null role; buyers always have both.
export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  userType: userTypeSchema,
  role: z.string().nullable(),
  orgId: z.string().uuid().nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authResponseSchema = z.object({
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
