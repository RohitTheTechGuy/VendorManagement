import { z } from "zod";
import { teamMemberSchema, type CreateTeamMemberInput, type TeamMember } from "@vendor-management/shared";
import { http } from "./http.js";

const listSchema = z.object({ members: z.array(teamMemberSchema) });

export async function listTeam(): Promise<TeamMember[]> {
  const res = await http.get("/api/team");
  return listSchema.parse(res.data).members;
}

export async function createTeamMember(input: CreateTeamMemberInput): Promise<TeamMember> {
  const res = await http.post("/api/team", input);
  return z.object({ member: teamMemberSchema }).parse(res.data).member;
}

export async function removeTeamMember(id: string): Promise<void> {
  await http.delete(`/api/team/${id}`);
}
