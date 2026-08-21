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

// Length of the email verification code. Kept here so the client input and the
// server generator agree on one number.
export const OTP_LENGTH = 6;

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendOtpSchema = z.object({
  email: z.string().email(),
});
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

// Registration no longer logs the user in — it starts email verification. The
// account is created only once the OTP is verified (which returns AuthResponse).
export const registerResponseSchema = z.object({
  needsVerification: z.literal(true),
  email: z.string().email(),
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

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
