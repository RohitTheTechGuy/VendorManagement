import axios from "axios";
import {
  authResponseSchema,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from "@vendor-management/shared";
import { http } from "./http.js";

export async function apiRegister(input: RegisterInput): Promise<AuthUser> {
  const response = await http.post("/api/auth/register", input);
  return authResponseSchema.parse(response.data).user;
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
