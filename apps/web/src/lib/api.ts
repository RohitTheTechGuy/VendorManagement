import { healthResponseSchema, type HealthResponse } from "@vendor-management/shared";
import { http } from "./http.js";

export async function getHealth(): Promise<HealthResponse> {
  const response = await http.get("/api/health");
  return healthResponseSchema.parse(response.data);
}
