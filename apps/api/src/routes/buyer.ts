import { Router } from "express";
import {
  verifyRequestSchema,
  resolveCheckSchema,
  reviewActionSchema,
  requestChangesSchema,
  REQUIRED_TO_CLEAR,
  DEEP_CHECKS,
  CONTRACT_TYPES,
  type VerifyRequestInput,
  type ResolveCheckInput,
  type ReviewActionInput,
  type RequestChangesInput,
} from "@vendor-management/shared";
import type { BuyerRole } from "@prisma/client";
import { prisma } from "@vendor-management/db";
import { requireAuth } from "../middleware/require-auth.js";
import { requireBuyer, requireOwnLink } from "../middleware/authz.js";
import { validateBody } from "../middleware/validate.js";
import { transition } from "../lib/link-state.js";
import { loadBuyerLinkDetail, mergedFields } from "../lib/buyer-link-dto.js";
import { checkJoinGate } from "../lib/join-gate.js";
import { resolveErpIfDue, markErpSyncToFail, ERP_DELAY_MS } from "../lib/erp.js";
import { sendNotifyEmail } from "../lib/email.js";

// States that mean a requirement already has (or has moved past) an award.
const POST_AWARD_STATES = [
  "AWARDED",
  "FULL_IN_PROGRESS",
  "FULL_SUBMITTED",
  "FULL_UNDER_REVIEW",
  "CONTRACTS_IN_PROGRESS",
  "APPROVED",
  "ERP_SYNCING",
  "ONBOARDED",
] as const;

const APPROVER_ROLES: BuyerRole[] = ["QUALITY", "FINANCE", "TAX", "LEGAL"];
const REVIEW_SLA_HOURS = 48;
import {
  resolveDueChecks,
  subjectForCheck,
  CHECK_RESOLVE_MS,
} from "../lib/verification.js";

export const buyerRouter = Router();
buyerRouter.use(requireAuth, requireBuyer);

// Open the drawer. Reading a submitted link starts the review, and any due
// verification results are resolved lazily so the buyer always sees fresh state.
buyerRouter.get("/links/:id", requireOwnLink(), async (req, res, next) => {
  try {
    if (req.link!.state === "PREQUAL_SUBMITTED") {
      await transition(req.link!.id, "PREQUAL_UNDER_REVIEW", {
        actorType: "BUYER",
        actorId: req.user!.userId,
        side: "BUYER",
        note: "Opened for review",
      });
    } else if (req.link!.state === "FULL_SUBMITTED") {
      await transition(req.link!.id, "FULL_UNDER_REVIEW", {
        actorType: "BUYER",
        actorId: req.user!.userId,
        side: "BUYER",
        note: "Opened for review",
      });
    }
    await resolveDueChecks(req.link!.id);
    await resolveErpIfDue(req.link!.id);
    const detail = await loadBuyerLinkDetail(req.link!.id);
    if (!detail) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

// Trigger a mocked verification check.
buyerRouter.post(
  "/links/:id/verify",
  requireOwnLink(),
  validateBody(verifyRequestSchema),
  async (req, res, next) => {
    try {
      const { checkType } = req.body as VerifyRequestInput;
      const fields = await mergedFields(req.link!.id);
      const subject = subjectForCheck(checkType, fields);

      const existing = await prisma.verificationCheck.findFirst({
        where: { linkId: req.link!.id, checkType },
      });
      if (existing?.status === "RUNNING") {
        res.status(409).json({ error: "This check is already running." });
        return;
      }

      const now = new Date();
      const check = existing
        ? await prisma.verificationCheck.update({
            where: { id: existing.id },
            data: {
              status: "RUNNING",
              subjectValue: subject,
              ranAt: now,
              matchScore: null,
              detail: undefined,
              expiresAt: null,
            },
          })
        : await prisma.verificationCheck.create({
            data: { linkId: req.link!.id, checkType, subjectValue: subject, status: "RUNNING", ranAt: now },
          });

      // Best-effort prompt resolution; reads also resolve lazily.
      setTimeout(() => {
        void resolveDueChecks(req.link!.id);
      }, CHECK_RESOLVE_MS + 50);

      res.status(202).json({ id: check.id, status: check.status });
    } catch (error) {
      next(error);
    }
  },
);

// Accept or reject a NEEDS_REVIEW (name-band) result.
buyerRouter.post(
  "/links/:id/checks/:checkId/resolve",
  requireOwnLink(),
  validateBody(resolveCheckSchema),
  async (req, res, next) => {
    try {
      const { decision } = req.body as ResolveCheckInput;
      const rawCheckId = req.params.checkId;
      const checkId = Array.isArray(rawCheckId) ? rawCheckId[0] : rawCheckId;
      const check = await prisma.verificationCheck.findFirst({
        where: { id: checkId, linkId: req.link!.id },
      });
      if (!check) {
        res.status(404).json({ error: "Check not found" });
        return;
      }
      if (check.status !== "NEEDS_REVIEW") {
        res.status(409).json({ error: "This check is not awaiting a decision." });
        return;
      }
      await prisma.verificationCheck.update({
        where: { id: check.id },
        data: { status: decision === "accept" ? "ACCEPTED" : "REJECTED" },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

// Hard-fail path: send the pre-qual (or full pack) back to the vendor to fix.
buyerRouter.post(
  "/links/:id/request-changes",
  requireOwnLink(),
  validateBody(requestChangesSchema),
  async (req, res, next) => {
    try {
      const { note, documentKeys } = req.body as RequestChangesInput;
      const state = req.link!.state;
      const target =
        state === "PREQUAL_UNDER_REVIEW" || state === "PREQUAL_SUBMITTED"
          ? "PREQUAL_IN_PROGRESS"
          : state === "FULL_UNDER_REVIEW" || state === "CONTRACTS_IN_PROGRESS" || state === "FULL_SUBMITTED"
            ? "FULL_IN_PROGRESS"
            : null;
      if (!target) {
        res.status(409).json({ error: "Changes cannot be requested from this state." });
        return;
      }

      await prisma.$transaction(async (tx) => {
        // Reopen the affected submission(s) and flag any named documents.
        const stage = target === "PREQUAL_IN_PROGRESS" ? "PREQUAL" : "FULL";
        await tx.submission.updateMany({ where: { linkId: req.link!.id, stage }, data: { status: "IN_PROGRESS" } });
        if (documentKeys && documentKeys.length > 0) {
          await tx.document.updateMany({
            where: { linkId: req.link!.id, checklistItemKey: { in: documentKeys } },
            data: { status: "REJECTED", rejectionReason: note },
          });
        }
        await transition(
          req.link!.id,
          target,
          { actorType: "BUYER", actorId: req.user!.userId, side: "BUYER", note: `Changes requested: ${note}` },
          tx,
        );
      });

      const detail = await loadBuyerLinkDetail(req.link!.id);
      res.json(detail);
    } catch (error) {
      next(error);
    }
  },
);

// Score + Clear, or Reject.
buyerRouter.post(
  "/links/:id/review",
  requireOwnLink(),
  validateBody(reviewActionSchema),
  async (req, res, next) => {
    try {
      const body = req.body as ReviewActionInput;
      if (req.link!.state !== "PREQUAL_UNDER_REVIEW") {
        res.status(409).json({ error: "This candidate is not under pre-qualification review." });
        return;
      }

      if (body.action === "reject") {
        await transition(req.link!.id, "REJECTED", {
          actorType: "BUYER",
          actorId: req.user!.userId,
          side: "BUYER",
          note: `Rejected: ${body.reason}`,
        });
        res.json(await loadBuyerLinkDetail(req.link!.id));
        return;
      }

      // Clear: required checks must be resolved (PASSED or reviewer-ACCEPTED).
      const checks = await prisma.verificationCheck.findMany({ where: { linkId: req.link!.id } });
      const byType = new Map(checks.map((c) => [c.checkType, c.status]));
      const unresolved = REQUIRED_TO_CLEAR.filter((t) => {
        const s = byType.get(t);
        return s !== "PASSED" && s !== "ACCEPTED";
      });
      if (unresolved.length > 0) {
        res.status(409).json({
          error: `Resolve these checks before clearing: ${unresolved.join(", ")}`,
        });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.vendorBuyerLink.update({
          where: { id: req.link!.id },
          data: { prequalScore: body.score },
        });
        await transition(
          req.link!.id,
          "PREQUAL_CLEARED",
          { actorType: "BUYER", actorId: req.user!.userId, side: "BUYER", note: `Cleared (score ${body.score})` },
          tx,
        );
      });

      res.json(await loadBuyerLinkDetail(req.link!.id));
    } catch (error) {
      next(error);
    }
  },
);

// Award — the buyer picks ONE pre-qualified candidate. Enforced server-side:
// a second award on the same requirement is rejected. Awarding sets up the full
// pack: 6 contracts (awaiting legal draft) + 4 parallel approver tasks.
buyerRouter.post("/links/:id/award", requireOwnLink(), async (req, res, next) => {
  try {
    if (req.link!.state !== "PREQUAL_CLEARED") {
      res.status(409).json({ error: "Only a pre-qualified candidate can be awarded." });
      return;
    }

    const link = await prisma.vendorBuyerLink.findUnique({
      where: { id: req.link!.id },
      select: {
        requirementId: true,
        orgId: true,
        candidate: { select: { legalName: true, contactEmail: true } },
        requirement: { select: { title: true } },
      },
    });
    if (!link) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // One award per requirement.
    const alreadyAwarded = await prisma.vendorBuyerLink.count({
      where: { requirementId: link.requirementId, state: { in: [...POST_AWARD_STATES] } },
    });
    if (alreadyAwarded > 0) {
      res.status(409).json({ error: "Another candidate has already been awarded for this requirement." });
      return;
    }

    // Map each approver role to a user in the org (if one exists).
    const approvers = await prisma.appUser.findMany({
      where: { orgId: link.orgId, userType: "BUYER", role: { in: APPROVER_ROLES } },
      select: { id: true, role: true },
    });
    const approverByRole = new Map(approvers.map((a) => [a.role, a.id]));

    await prisma.$transaction(async (tx) => {
      await transition(
        req.link!.id,
        "AWARDED",
        { actorType: "BUYER", actorId: req.user!.userId, side: "BUYER", note: "Awarded" },
        tx,
      );
      await tx.vendorBuyerLink.update({
        where: { id: req.link!.id },
        data: { stage: "FULL", awardedAt: new Date() },
      });
      // Full-pack submission.
      await tx.submission.upsert({
        where: { linkId_stage: { linkId: req.link!.id, stage: "FULL" } },
        update: {},
        create: { linkId: req.link!.id, stage: "FULL", status: "IN_PROGRESS" },
      });
      // Six contracts awaiting a legal draft.
      await tx.contract.createMany({
        data: CONTRACT_TYPES.map((contractType) => ({
          linkId: req.link!.id,
          contractType,
          state: "DRAFT_PENDING" as const,
        })),
        skipDuplicates: true,
      });
      // Four parallel approver tasks.
      await tx.reviewTask.createMany({
        data: APPROVER_ROLES.map((role) => ({
          linkId: req.link!.id,
          role,
          assignedUserId: approverByRole.get(role) ?? null,
          slaHours: REVIEW_SLA_HOURS,
        })),
        skipDuplicates: true,
      });
    });

    // Notify the vendor (best-effort).
    void sendNotifyEmail({
      to: link.candidate.contactEmail,
      subject: `You've been awarded: ${link.requirement.title}`,
      html: `<p>Congratulations — <strong>${link.candidate.legalName}</strong> has been awarded <strong>${link.requirement.title}</strong>. Sign in to your vendor portal to complete the full onboarding pack.</p>`,
    });

    res.json(await loadBuyerLinkDetail(req.link!.id));
  } catch (error) {
    next(error);
  }
});

// Advance a reviewed full pack into approvals + contracts. Deep checks must be
// resolved first. Re-entry resets any CHANGES_REQUESTED tasks back to PENDING so
// their approver re-reviews (approvals already granted are preserved).
buyerRouter.post("/links/:id/advance-to-contracts", requireOwnLink(), async (req, res, next) => {
  try {
    if (req.link!.state !== "FULL_UNDER_REVIEW") {
      res.status(409).json({ error: "The full pack is not under review." });
      return;
    }
    const checks = await prisma.verificationCheck.findMany({ where: { linkId: req.link!.id } });
    const byType = new Map(checks.map((c) => [c.checkType, c.status]));
    const unresolved = DEEP_CHECKS.filter((t) => {
      const s = byType.get(t);
      return s !== "PASSED" && s !== "ACCEPTED";
    });
    if (unresolved.length > 0) {
      res.status(409).json({ error: `Resolve these checks first: ${unresolved.join(", ")}` });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.reviewTask.updateMany({
        where: { linkId: req.link!.id, status: "CHANGES_REQUESTED" },
        data: { status: "PENDING" },
      });
      await transition(
        req.link!.id,
        "CONTRACTS_IN_PROGRESS",
        { actorType: "BUYER", actorId: req.user!.userId, side: "BUYER", note: "Advanced to approvals & contracts" },
        tx,
      );
    });

    res.json(await loadBuyerLinkDetail(req.link!.id));
  } catch (error) {
    next(error);
  }
});

// Push to SAP — enabled only when the join gate passes. The server ALWAYS
// re-checks the gate (never trusts the client) before starting the sync.
buyerRouter.post("/links/:id/push-erp", requireOwnLink(), async (req, res, next) => {
  try {
    if (req.link!.state !== "APPROVED") {
      res.status(409).json({ error: "This link is not approved for ERP push." });
      return;
    }
    if (!(await checkJoinGate(req.link!.id))) {
      res.status(409).json({ error: "Approvals and contracts are not all complete." });
      return;
    }
    await transition(req.link!.id, "ERP_SYNCING", {
      actorType: "BUYER",
      actorId: req.user!.userId,
      side: "BUYER",
      note: "Pushed to SAP",
    });
    // Optional simulated failure for the demo (body: { simulateFailure: true }).
    if (req.body?.simulateFailure === true) markErpSyncToFail(req.link!.id);
    setTimeout(() => void resolveErpIfDue(req.link!.id), ERP_DELAY_MS + 50);

    res.json(await loadBuyerLinkDetail(req.link!.id));
  } catch (error) {
    next(error);
  }
});

// Retry a failed ERP push.
buyerRouter.post("/links/:id/retry-erp", requireOwnLink(), async (req, res, next) => {
  try {
    if (req.link!.state !== "ERP_FAILED") {
      res.status(409).json({ error: "There is no failed ERP push to retry." });
      return;
    }
    await transition(req.link!.id, "ERP_SYNCING", {
      actorType: "BUYER",
      actorId: req.user!.userId,
      side: "BUYER",
      note: "Retried ERP push",
    });
    setTimeout(() => void resolveErpIfDue(req.link!.id), ERP_DELAY_MS + 50);
    res.json(await loadBuyerLinkDetail(req.link!.id));
  } catch (error) {
    next(error);
  }
});

// Download ERP pack — the onboarded record plus its executed contract files.
buyerRouter.get("/links/:id/erp-pack", requireOwnLink(), async (req, res, next) => {
  try {
    const link = await prisma.vendorBuyerLink.findUnique({
      where: { id: req.link!.id },
      select: {
        erpVendorCode: true,
        onboardedAt: true,
        candidate: { select: { legalName: true, contactEmail: true } },
        requirement: { select: { title: true } },
        contracts: {
          where: { state: "EXECUTED" },
          select: {
            contractType: true,
            versions: { select: { kind: true, fileName: true, fileBlobId: true } },
          },
        },
      },
    });
    if (!link || !link.erpVendorCode) {
      res.status(409).json({ error: "This vendor is not onboarded yet." });
      return;
    }
    res.setHeader("Content-Disposition", `attachment; filename="erp-pack-${link.erpVendorCode}.json"`);
    res.json({
      vendorCode: link.erpVendorCode,
      onboardedAt: link.onboardedAt,
      vendor: link.candidate,
      requirement: link.requirement.title,
      executedContracts: link.contracts.map((c) => ({
        contractType: c.contractType,
        signedFiles: c.versions
          .filter((v) => v.kind === "VENDOR_SIGNED" || v.kind === "BUYER_SIGNED")
          .map((v) => ({ kind: v.kind, fileName: v.fileName, downloadPath: `/api/files/${v.fileBlobId}` })),
      })),
    });
  } catch (error) {
    next(error);
  }
});
