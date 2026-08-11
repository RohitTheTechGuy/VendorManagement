import crypto from "node:crypto";
import { Router } from "express";
import {
  createRequirementSchema,
  addCandidatesSchema,
  type CreateRequirementInput,
  type AddCandidatesInput,
  type RequirementSummary,
  type Candidate,
  type RequirementDetail,
  type InviteResult,
} from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validateBody } from "../middleware/validate.js";
import { sendInviteEmail } from "../lib/email.js";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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

interface CandidateRow {
  id: string;
  requirementId: string;
  source: Candidate["source"];
  directoryVendorId: string | null;
  legalName: string;
  contactEmail: string;
  contactPhone: string | null;
  pan: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  inviteStatus: Candidate["inviteStatus"];
  createdAt: Date;
}

function toCandidate(c: CandidateRow): Candidate {
  return {
    id: c.id,
    requirementId: c.requirementId,
    source: c.source,
    directoryVendorId: c.directoryVendorId,
    legalName: c.legalName,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    pan: c.pan,
    gstin: c.gstin,
    city: c.city,
    state: c.state,
    inviteStatus: c.inviteStatus,
    createdAt: c.createdAt.toISOString(),
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

// Load an org-scoped requirement with candidates, or return 404.
async function loadDetail(orgId: string, id: string): Promise<RequirementDetail | null> {
  const r = await prisma.requirement.findFirst({
    where: { id, orgId },
    include: { candidates: { orderBy: { createdAt: "asc" } } },
  });
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    partCategory: r.partCategory,
    processCategories: r.processCategories,
    plantLocation: r.plantLocation,
    targetAwardDate: r.targetAwardDate ? r.targetAwardDate.toISOString() : null,
    stage: r.stage,
    createdAt: r.createdAt.toISOString(),
    candidates: r.candidates.map(toCandidate),
  };
}

requirementsRouter.get("/:id", async (req, res, next) => {
  try {
    const detail = await loadDetail(req.user!.orgId, req.params.id);
    if (!detail) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    res.json({ requirement: detail });
  } catch (error) {
    next(error);
  }
});

requirementsRouter.post("/:id/candidates", validateBody(addCandidatesSchema), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const requirementId = req.params.id as string;
    const { candidates } = req.body as AddCandidatesInput;

    const requirement = await prisma.requirement.findFirst({
      where: { id: requirementId, orgId },
      include: { candidates: { select: { pan: true, directoryVendorId: true } } },
    });
    if (!requirement) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }

    // Dedupe against candidates already on this requirement.
    const existingPans = new Set(requirement.candidates.map((c) => c.pan).filter(Boolean));
    const existingVendorIds = new Set(
      requirement.candidates.map((c) => c.directoryVendorId).filter((v): v is string => Boolean(v)),
    );

    const dataToCreate: Array<{
      requirementId: string;
      orgId: string;
      source: "MANUAL" | "DIRECTORY";
      directoryVendorId: string | null;
      legalName: string;
      contactEmail: string;
      contactPhone: string | null;
      pan: string | null;
      gstin: string | null;
      city: string | null;
      state: string | null;
    }> = [];

    for (const item of candidates) {
      if (item.source === "directory") {
        if (existingVendorIds.has(item.directoryVendorId)) continue;
        const vendor = await prisma.directoryVendor.findUnique({ where: { id: item.directoryVendorId } });
        if (!vendor) {
          res.status(400).json({ error: "Directory vendor not found" });
          return;
        }
        if (vendor.pan && existingPans.has(vendor.pan)) continue;
        existingVendorIds.add(vendor.id);
        if (vendor.pan) existingPans.add(vendor.pan);
        dataToCreate.push({
          requirementId,
          orgId,
          source: "DIRECTORY",
          directoryVendorId: vendor.id,
          legalName: vendor.legalName,
          contactEmail: vendor.contactEmail,
          contactPhone: null,
          pan: vendor.pan,
          gstin: vendor.primaryGstin,
          city: vendor.city,
          state: vendor.state,
        });
      } else {
        if (item.pan && existingPans.has(item.pan)) continue;
        if (item.pan) existingPans.add(item.pan);
        dataToCreate.push({
          requirementId,
          orgId,
          source: "MANUAL",
          directoryVendorId: null,
          legalName: item.legalName,
          contactEmail: item.contactEmail,
          contactPhone: item.contactPhone ?? null,
          pan: item.pan ?? null,
          gstin: item.gstin ?? null,
          city: item.city ?? null,
          state: item.state ?? null,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (dataToCreate.length > 0) {
        await tx.candidate.createMany({ data: dataToCreate });
      }
      // First candidate(s) move a draft requirement forward.
      if (requirement.stage === "DRAFT" && dataToCreate.length > 0) {
        await tx.requirement.update({ where: { id: requirementId }, data: { stage: "CANDIDATES_SELECTED" } });
      }
    });

    const detail = await loadDetail(orgId, requirementId);
    res.status(201).json({ requirement: detail, added: dataToCreate.length });
  } catch (error) {
    next(error);
  }
});

requirementsRouter.delete("/:id/candidates/:candidateId", async (req, res, next) => {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: { id: req.params.candidateId, requirementId: req.params.id, orgId: req.user!.orgId },
    });
    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }
    if (candidate.inviteStatus !== "NOT_INVITED") {
      res.status(409).json({ error: "Cannot remove a candidate that has already been invited" });
      return;
    }
    await prisma.candidate.delete({ where: { id: candidate.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Dispatch magic-link invites to every not-yet-invited candidate.
requirementsRouter.post("/:id/invites", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const requirementId = req.params.id as string;

    const requirement = await prisma.requirement.findFirst({
      where: { id: requirementId, orgId },
      include: { candidates: { where: { inviteStatus: "NOT_INVITED" }, orderBy: { createdAt: "asc" } } },
    });
    if (!requirement) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }

    const org = await prisma.buyerOrg.findUnique({ where: { id: orgId } });
    const orgName = org?.legalName ?? "Your buyer";

    const results: InviteResult[] = [];

    for (const candidate of requirement.candidates) {
      // Cryptographically-random token; only its hash is stored (plus the plain
      // value in dev so the link is visible). TODO: drop magicTokenPlain in prod.
      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const link = `${env.APP_BASE_URL}/invite/${token}`;

      // Email (or log) BEFORE persisting; never throws.
      const sent = await sendInviteEmail({
        to: candidate.contactEmail,
        orgName,
        requirementTitle: requirement.title,
        link,
      });

      // Each candidate's write is its own transaction so a mid-loop failure
      // never leaves a half-written invite.
      await prisma.$transaction(async (tx) => {
        await tx.invitation.create({
          data: {
            candidateId: candidate.id,
            requirementId,
            orgId,
            tokenHash,
            magicTokenPlain: token,
            email: candidate.contactEmail,
            expiresAt: new Date(Date.now() + INVITE_TTL_MS),
            status: "SENT",
          },
        });
        await tx.candidate.update({ where: { id: candidate.id }, data: { inviteStatus: "INVITED" } });
      });

      results.push({ candidateId: candidate.id, email: candidate.contactEmail, sent, link });
    }

    // Move the requirement forward once invites have gone out.
    if (results.length > 0 && (requirement.stage === "CANDIDATES_SELECTED" || requirement.stage === "DRAFT")) {
      await prisma.requirement.update({ where: { id: requirementId }, data: { stage: "INVITES_SENT" } });
    }

    const detail = await loadDetail(orgId, requirementId);
    res.json({ results, requirement: detail });
  } catch (error) {
    next(error);
  }
});
