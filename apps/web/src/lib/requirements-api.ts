import {
  requirementListResponseSchema,
  requirementResponseSchema,
  type CreateRequirementInput,
  type RequirementSummary,
} from "@vendor-management/shared";
import { http } from "./http.js";

export async function getRequirements(): Promise<RequirementSummary[]> {
  const response = await http.get("/api/requirements");
  return requirementListResponseSchema.parse(response.data).requirements;
}

export async function createRequirement(input: CreateRequirementInput): Promise<RequirementSummary> {
  const response = await http.post("/api/requirements", input);
  return requirementResponseSchema.parse(response.data).requirement;
}
