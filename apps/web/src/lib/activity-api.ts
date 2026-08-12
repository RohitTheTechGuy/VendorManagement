import { z } from "zod";
import { activityItemSchema, type ActivityItem } from "@vendor-management/shared";
import { http } from "./http.js";

const schema = z.object({ items: z.array(activityItemSchema) });

export async function getActivity(): Promise<ActivityItem[]> {
  const res = await http.get("/api/buyer/activity");
  return schema.parse(res.data).items;
}
