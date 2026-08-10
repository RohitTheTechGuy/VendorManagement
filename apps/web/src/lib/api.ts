import { healthResponseSchema, type HealthResponse } from "@vendor-management/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/health`, { credentials: "include" });
  if (!response.ok) throw new Error("API request failed");
  return healthResponseSchema.parse(await response.json());
}
