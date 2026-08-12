import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { directoryQuerySchema, type DirectoryVendor } from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { requireAuth } from "../middleware/require-auth.js";
import { requireBuyer, buyerOrgId } from "../middleware/authz.js";

export const directoryRouter = Router();

directoryRouter.use(requireAuth, requireBuyer);

directoryRouter.get("/", async (req, res, next) => {
  try {
    const parsed = directoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query", issues: parsed.error.flatten() });
      return;
    }
    const { search, process, state, requirementId } = parsed.data;

    const where: Prisma.DirectoryVendorWhereInput = {};
    if (search) where.legalName = { contains: search, mode: "insensitive" };
    if (process) where.processTags = { has: process };
    if (state) where.state = { equals: state, mode: "insensitive" };

    // Exclude vendors already added to this requirement (org-scoped).
    if (requirementId) {
      const added = await prisma.candidate.findMany({
        where: { requirementId, orgId: buyerOrgId(req), directoryVendorId: { not: null } },
        select: { directoryVendorId: true },
      });
      const ids = added.map((a) => a.directoryVendorId).filter((v): v is string => Boolean(v));
      if (ids.length > 0) where.id = { notIn: ids };
    }

    const rows = await prisma.directoryVendor.findMany({ where, orderBy: { legalName: "asc" } });

    const vendors: DirectoryVendor[] = rows.map((v) => ({
      id: v.id,
      legalName: v.legalName,
      pan: v.pan,
      primaryGstin: v.primaryGstin,
      contactEmail: v.contactEmail,
      city: v.city,
      state: v.state,
      processTags: v.processTags,
      certificationTags: v.certificationTags,
      badgeState: v.badgeState,
    }));

    res.json({ vendors });
  } catch (error) {
    next(error);
  }
});
