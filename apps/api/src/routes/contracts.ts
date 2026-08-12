import { Router } from "express";
import {
  contractUploadSchema,
  contractCommentInputSchema,
  VENDOR_TURN_CONTRACT_STATES,
  type ContractUploadInput,
  type ContractCommentInput,
} from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { requireAuth } from "../middleware/require-auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  assertContractTransition,
  nextVersionNo,
  recomputeExecution,
  advanceLinkIfGateOpen,
  IllegalContractTransitionError,
} from "../lib/contract-state.js";

export const contractsRouter = Router();
contractsRouter.use(requireAuth);

function paramId(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v ?? "");
}

// Load a contract with its link and current state; verifies the caller may act
// as `side`. Legal actions require a buyer with the LEGAL role in the org;
// vendor actions require the owning vendor.
async function loadContract(contractId: string) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      state: true,
      currentVersionId: true,
      linkId: true,
      link: { select: { orgId: true, vendorUserId: true } },
    },
  });
}

// ---- Legal (buyer, role LEGAL) --------------------------------------------

contractsRouter.post(
  "/:contractId/draft",
  validateBody(contractUploadSchema),
  async (req, res, next) => {
    try {
      const c = await loadContract(paramId(req.params.contractId));
      if (!c) return void res.status(404).json({ error: "Contract not found" });
      if (req.user!.userType !== "BUYER" || req.user!.role !== "LEGAL" || c.link.orgId !== req.user!.orgId) {
        return void res.status(403).json({ error: "Forbidden" });
      }
      if (c.state !== "DRAFT_PENDING") {
        return void res.status(409).json({ error: "A draft can only be uploaded first." });
      }
      const { fileBlobId, fileName } = req.body as ContractUploadInput;
      assertContractTransition(c.state, "DRAFT_UPLOADED");
      await prisma.$transaction(async (tx) => {
        const version = await tx.contractVersion.create({
          data: {
            contractId: c.id,
            linkId: c.linkId,
            versionNo: await nextVersionNo(tx, c.id),
            fileBlobId,
            fileName,
            uploadedBySide: "BUYER",
            kind: "DRAFT",
          },
        });
        await tx.contract.update({
          where: { id: c.id },
          data: { state: "DRAFT_UPLOADED", currentVersionId: version.id, dispatchedAt: new Date() },
        });
      });
      res.json({ ok: true });
    } catch (error) {
      handle(error, res, next);
    }
  },
);

contractsRouter.post(
  "/:contractId/revise",
  validateBody(contractUploadSchema),
  async (req, res, next) => {
    try {
      const c = await loadContract(paramId(req.params.contractId));
      if (!c) return void res.status(404).json({ error: "Contract not found" });
      if (req.user!.userType !== "BUYER" || req.user!.role !== "LEGAL" || c.link.orgId !== req.user!.orgId) {
        return void res.status(403).json({ error: "Forbidden" });
      }
      if (c.state !== "CHANGES_REQUESTED") {
        return void res.status(409).json({ error: "A revision can only be uploaded after changes are requested." });
      }
      const { fileBlobId, fileName } = req.body as ContractUploadInput;
      assertContractTransition(c.state, "REVISED");
      await prisma.$transaction(async (tx) => {
        const version = await tx.contractVersion.create({
          data: {
            contractId: c.id,
            linkId: c.linkId,
            versionNo: await nextVersionNo(tx, c.id),
            fileBlobId,
            fileName,
            uploadedBySide: "BUYER",
            kind: "REVISED",
            supersedesVersionId: c.currentVersionId,
          },
        });
        await tx.contract.update({
          where: { id: c.id },
          data: { state: "REVISED", currentVersionId: version.id },
        });
      });
      res.json({ ok: true });
    } catch (error) {
      handle(error, res, next);
    }
  },
);

contractsRouter.post(
  "/:contractId/buyer-sign",
  validateBody(contractUploadSchema),
  async (req, res, next) => {
    try {
      const c = await loadContract(paramId(req.params.contractId));
      if (!c) return void res.status(404).json({ error: "Contract not found" });
      if (req.user!.userType !== "BUYER" || req.user!.role !== "LEGAL" || c.link.orgId !== req.user!.orgId) {
        return void res.status(403).json({ error: "Forbidden" });
      }
      if (c.state !== "AWAITING_SIGNATURES" && c.state !== "PARTIALLY_EXECUTED") {
        return void res.status(409).json({ error: "The contract is not ready for signatures." });
      }
      await signContract(c.id, c.linkId, "BUYER", req.body as ContractUploadInput);
      res.json({ ok: true });
    } catch (error) {
      handle(error, res, next);
    }
  },
);

// ---- Vendor ----------------------------------------------------------------

contractsRouter.post(
  "/:contractId/request-changes",
  validateBody(contractCommentInputSchema),
  async (req, res, next) => {
    try {
      const c = await loadContract(paramId(req.params.contractId));
      if (!c) return void res.status(404).json({ error: "Contract not found" });
      if (req.user!.userType !== "VENDOR" || c.link.vendorUserId !== req.user!.userId) {
        return void res.status(403).json({ error: "Forbidden" });
      }
      if (!VENDOR_TURN_CONTRACT_STATES.includes(c.state)) {
        return void res.status(409).json({ error: "It's not your turn to act on this contract." });
      }
      const { comment, fileBlobId, fileName } = req.body as ContractCommentInput;
      assertContractTransition(c.state, "CHANGES_REQUESTED");
      await prisma.$transaction(async (tx) => {
        if (c.currentVersionId) {
          await tx.contractComment.create({
            data: {
              contractVersionId: c.currentVersionId,
              linkId: c.linkId,
              authorSide: "VENDOR",
              body: comment,
              fileBlobId: fileBlobId ?? null,
              fileName: fileName ?? null,
            },
          });
        }
        await tx.contract.update({ where: { id: c.id }, data: { state: "CHANGES_REQUESTED" } });
      });
      res.json({ ok: true });
    } catch (error) {
      handle(error, res, next);
    }
  },
);

contractsRouter.post("/:contractId/agree", async (req, res, next) => {
  try {
    const c = await loadContract(paramId(req.params.contractId));
    if (!c) return void res.status(404).json({ error: "Contract not found" });
    if (req.user!.userType !== "VENDOR" || c.link.vendorUserId !== req.user!.userId) {
      return void res.status(403).json({ error: "Forbidden" });
    }
    if (!VENDOR_TURN_CONTRACT_STATES.includes(c.state)) {
      return void res.status(409).json({ error: "It's not your turn to act on this contract." });
    }
    assertContractTransition(c.state, "AGREED");
    assertContractTransition("AGREED", "AWAITING_SIGNATURES");
    await prisma.contract.update({ where: { id: c.id }, data: { state: "AWAITING_SIGNATURES" } });
    res.json({ ok: true });
  } catch (error) {
    handle(error, res, next);
  }
});

contractsRouter.post(
  "/:contractId/vendor-sign",
  validateBody(contractUploadSchema),
  async (req, res, next) => {
    try {
      const c = await loadContract(paramId(req.params.contractId));
      if (!c) return void res.status(404).json({ error: "Contract not found" });
      if (req.user!.userType !== "VENDOR" || c.link.vendorUserId !== req.user!.userId) {
        return void res.status(403).json({ error: "Forbidden" });
      }
      if (c.state !== "AWAITING_SIGNATURES" && c.state !== "PARTIALLY_EXECUTED") {
        return void res.status(409).json({ error: "The contract is not ready for signatures." });
      }
      await signContract(c.id, c.linkId, "VENDOR", req.body as ContractUploadInput);
      res.json({ ok: true });
    } catch (error) {
      handle(error, res, next);
    }
  },
);

// Shared signing logic: append an immutable signed version, recompute execution,
// then advance the link if the join gate is now open.
async function signContract(
  contractId: string,
  linkId: string,
  side: "BUYER" | "VENDOR",
  body: ContractUploadInput,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.contractVersion.create({
      data: {
        contractId,
        linkId,
        versionNo: await nextVersionNo(tx, contractId),
        fileBlobId: body.fileBlobId,
        fileName: body.fileName,
        uploadedBySide: side,
        kind: side === "BUYER" ? "BUYER_SIGNED" : "VENDOR_SIGNED",
      },
    });
    await recomputeExecution(tx, contractId);
  });
  await advanceLinkIfGateOpen(linkId);
}

function handle(error: unknown, res: import("express").Response, next: import("express").NextFunction) {
  if (error instanceof IllegalContractTransitionError) {
    res.status(409).json({ error: error.message });
    return;
  }
  next(error);
}
