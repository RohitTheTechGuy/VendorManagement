import { Router } from "express";
import { createRequirementSchema, type CreateRequirementInput, type RequirementSummary } from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { requireAuth } from "../middleware/require-auth.js";
import { validateBody } from "../middleware/validate.js";

export const requirementsRouter = Router();

// Every route is org-scoped from the JWT — a buyer never sees another org's data.
requirementsRouter.use(requireAuth);

interface RequirementRow {
  id: string;
  title: string;
  partCategory: string | null;
  processCategories: string[];
  plantLocation: string | null;
  targetAwardDate: Date | null;
  stage: RequirementSummary["stage"];
  createdAt: Date;
  _count: { candidates: number };
}

function toSummary(r: RequirementRow): RequirementSummary {
  return {
    id: r.id,
    title: r.title,
    partCategory: r.partCategory,
    processCategories: r.processCategories,
    plantLocation: r.plantLocation,
    targetAwardDate: r.targetAwardDate ? r.targetAwardDate.toISOString() : null,
    stage: r.stage,
    candidateCount: r._count.candidates,
    createdAt: r.createdAt.toISOString(),
  };
}

requirementsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.requirement.findMany({
      where: { orgId: req.user!.orgId },
      include: { _count: { select: { candidates: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ requirements: rows.map(toSummary) });
  } catch (error) {
    next(error);
  }
});

requirementsRouter.post("/", validateBody(createRequirementSchema), async (req, res, next) => {
  try {
    const input = req.body as CreateRequirementInput;
    const created = await prisma.requirement.create({
      data: {
        orgId: req.user!.orgId,
        ownerUserId: req.user!.userId,
        title: input.title,
        partCategory: input.partCategory ?? null,
        processCategories: input.processCategories,
        plantLocation: input.plantLocation ?? null,
        targetAwardDate: input.targetAwardDate ? new Date(input.targetAwardDate) : null,
        stage: "DRAFT",
      },
      include: { _count: { select: { candidates: true } } },
    });
    res.status(201).json({ requirement: toSummary(created) });
  } catch (error) {
    next(error);
  }
});
