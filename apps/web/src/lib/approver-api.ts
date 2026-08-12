import { z } from "zod";
import { approverTaskSchema, type ApproverTask } from "@vendor-management/shared";
import { http } from "./http.js";

export async function listMyTasks(): Promise<ApproverTask[]> {
  const res = await http.get("/api/approver/tasks");
  return z.array(approverTaskSchema).parse(res.data);
}

export async function decideTask(
  taskId: string,
  decision: "approve" | "request_changes",
  comment?: string,
): Promise<void> {
  await http.post(`/api/approver/tasks/${taskId}/decide`, { decision, comment });
}
