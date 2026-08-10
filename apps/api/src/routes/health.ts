import { Router } from "express";
import { healthResponseSchema } from "@vendor-management/shared";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  const payload = healthResponseSchema.parse({ ok: true });
  response.json(payload);
});
