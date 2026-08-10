import { requirementListResponseSchema, type RequirementSummary } from "@vendor-management/shared";
import { http } from "./http.js";

export async function getRequirements(): Promise<RequirementSummary[]> {
  const response = await http.get("/api/requirements");
  return requirementListResponseSchema.parse(response.data).requirements;
}
