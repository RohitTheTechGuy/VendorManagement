import axios from "axios";
import {
  authResponseSchema,
  registerResponseSchema,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
  type RegisterResponse,
  type VerifyEmailInput,
} from "@vendor-management/shared";
import { http } from "./http.js";

// Registration no longer logs the user in — it starts email verification.
export async function apiRegister(input: RegisterInput): Promise<RegisterResponse> {
  const response = await http.post("/api/auth/register", input);
  return registerResponseSchema.parse(response.data);
}

// Verifying the emailed code creates the account and sets the session cookie.
export async function apiVerifyEmail(input: VerifyEmailInput): Promise<AuthUser> {
  const response = await http.post("/api/auth/verify-email", input);
  return authResponseSchema.parse(response.data).user;
}

export async function apiResendOtp(email: string): Promise<void> {
  await http.post("/api/auth/resend-otp", { email });
}

export async function apiLogin(input: LoginInput): Promise<AuthUser> {
  const response = await http.post("/api/auth/login", input);
  return authResponseSchema.parse(response.data).user;
}

export async function apiLogout(): Promise<void> {
  await http.post("/api/auth/logout");
}

// Returns the current user, or null when not authenticated (401).
export async function apiMe(): Promise<AuthUser | null> {
  try {
    const response = await http.get("/api/auth/me");
    return authResponseSchema.parse(response.data).user;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

// Pull a human-readable message out of an axios error response.
export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
}
