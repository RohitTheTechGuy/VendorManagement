import { Router } from "express";
import {
  saveFieldsSchema,
  attachDocumentSchema,
  checklistFor,
  type SaveFieldsInput,
  type AttachDocumentInput,
  type LinkStage,
} from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { requireAuth } from "../middleware/require-auth.js";
import { requireVendor, requireOwnLink } from "../middleware/authz.js";
import { validateBody } from "../middleware/validate.js";
import { transition } from "../lib/link-state.js";
import { loadVendorLinkDTO, ensureSubmission } from "../lib/link-dto.js";

export const linksRouter = Router();

// The vendor portal. Every route is vendor-only and scoped to the caller's own
// link (requireOwnLink).
linksRouter.use(requireAuth, requireVendor);

// States in which the vendor may edit the current stage.
const EDITABLE: Record<LinkStage, string> = {
  PREQUAL: "PREQUAL_IN_PROGRESS",
  FULL: "FULL_IN_PROGRESS",
};
const SUBMIT_TARGET: Record<LinkStage, "PREQUAL_SUBMITTED" | "FULL_SUBMITTED"> = {
  PREQUAL: "PREQUAL_SUBMITTED",
  FULL: "FULL_SUBMITTED",
};

// The vendor's own links (one per candidate engagement).
linksRouter.get("/", async (req, res, next) => {
  try {
    const links = await prisma.vendorBuyerLink.findMany({
      where: { vendorUserId: req.user!.userId },
      select: { id: true, state: true, stage: true, requirement: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      links.map((l) => ({
        id: l.id,
        state: l.state,
        stage: l.stage,
        requirementTitle: l.requirement.title,
      })),
    );
  } catch (error) {
    next(error);
  }
});

linksRouter.get("/:id", requireOwnLink(), async (req, res, next) => {
  try {
    // First time the awarded vendor opens the link, move it into the full pack.
    if (req.link!.state === "AWARDED") {
      await transition(req.link!.id, "FULL_IN_PROGRESS", {
        actorType: "VENDOR",
        actorId: req.user!.userId,
        side: "VENDOR",
        note: "Opened full pack",
      });
    }
    const dto = await loadVendorLinkDTO(req.link!.id);
    if (!dto) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(dto);
  } catch (error) {
    next(error);
  }
});

linksRouter.put(
  "/:id/fields",
  requireOwnLink(),
  validateBody(saveFieldsSchema),
  async (req, res, next) => {
    try {
      const link = await prisma.vendorBuyerLink.findUnique({
        where: { id: req.link!.id },
        select: { stage: true, state: true },
      });
      const stage = link?.stage;
      if (!stage || link.state !== EDITABLE[stage]) {
        res.status(409).json({ error: "This section is not editable right now." });
        return;
      }
      const submission = await ensureSubmission(req.link!.id, stage);
      const { fields } = req.body as SaveFieldsInput;

      await prisma.$transaction(
        Object.entries(fields).map(([fieldKey, value]) =>
          prisma.fieldValue.upsert({
            where: { submissionId_fieldKey: { submissionId: submission.id, fieldKey } },
            update: { value, source: "vendor" },
            create: { submissionId: submission.id, linkId: req.link!.id, fieldKey, value, source: "vendor" },
          }),
        ),
      );

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

linksRouter.post(
  "/:id/documents",
  requireOwnLink(),
  validateBody(attachDocumentSchema),
  async (req, res, next) => {
    try {
      const link = await prisma.vendorBuyerLink.findUnique({
        where: { id: req.link!.id },
        select: { stage: true, state: true },
      });
      const stage = link?.stage;
      if (!stage || link.state !== EDITABLE[stage]) {
        res.status(409).json({ error: "Documents cannot be changed right now." });
        return;
      }
      const submission = await ensureSubmission(req.link!.id, stage);
      const body = req.body as AttachDocumentInput;

      // One document per checklist item per submission — replace on re-upload.
      const existing = await prisma.document.findFirst({
        where: { submissionId: submission.id, checklistItemKey: body.checklistItemKey },
      });
      const doc = existing
        ? await prisma.document.update({
            where: { id: existing.id },
            data: {
              fileBlobId: body.fileBlobId,
              fileName: body.fileName,
              mimeType: body.mimeType,
              sizeBytes: body.sizeBytes,
              status: "PENDING",
              rejectionReason: null,
            },
          })
        : await prisma.document.create({
            data: {
              submissionId: submission.id,
              linkId: req.link!.id,
              checklistItemKey: body.checklistItemKey,
              fileBlobId: body.fileBlobId,
              fileName: body.fileName,
              mimeType: body.mimeType,
              sizeBytes: body.sizeBytes,
              status: "PENDING",
            },
          });

      res.status(201).json({ id: doc.id, checklistItemKey: doc.checklistItemKey });
    } catch (error) {
      next(error);
    }
  },
);

linksRouter.delete("/:id/documents/:docId", requireOwnLink(), async (req, res, next) => {
  try {
    const rawDocId = req.params.docId;
    const docId = Array.isArray(rawDocId) ? rawDocId[0] : rawDocId;
    await prisma.document.deleteMany({
      where: { id: docId, linkId: req.link!.id },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

linksRouter.post("/:id/submit", requireOwnLink(), async (req, res, next) => {
  try {
    const link = await prisma.vendorBuyerLink.findUnique({
      where: { id: req.link!.id },
      select: {
        stage: true,
        state: true,
        requirement: { select: { processCategories: true } },
        submissions: { include: { fieldValues: true, documents: true } },
      },
    });
    const stage = link?.stage;
    if (!stage || link.state !== EDITABLE[stage]) {
      res.status(409).json({ error: "This submission cannot be sent right now." });
      return;
    }

    const checklist = checklistFor(stage, link.requirement.processCategories);
    const submission = link.submissions.find((s) => s.stage === stage);
    const values = new Map((submission?.fieldValues ?? []).map((f) => [f.fieldKey, f.value ?? ""]));
    const docKeys = new Set((submission?.documents ?? []).map((d) => d.checklistItemKey));

    const errors: string[] = [];
    for (const field of checklist.fields) {
      const v = values.get(field.key)?.trim() ?? "";
      if (field.required && !v) {
        errors.push(`${field.label} is required`);
        continue;
      }
      if (v && field.pattern && !new RegExp(field.pattern).test(v)) {
        errors.push(`${field.label} is not in the expected format`);
      }
    }
    for (const doc of checklist.documents) {
      if (doc.required && !docKeys.has(doc.key)) {
        errors.push(`${doc.label} document is required`);
      }
    }
    if (errors.length > 0) {
      res.status(422).json({ error: "Please fix the highlighted items.", errors });
      return;
    }

    await prisma.$transaction(async (tx) => {
      if (submission) {
        await tx.submission.update({
          where: { id: submission.id },
          data: { status: "SUBMITTED", submittedAt: new Date() },
        });
      }
      await transition(
        req.link!.id,
        SUBMIT_TARGET[stage],
        { actorType: "VENDOR", actorId: req.user!.userId, side: "VENDOR", note: `${stage} submitted` },
        tx,
      );
    });

    const dto = await loadVendorLinkDTO(req.link!.id);
    res.json(dto);
  } catch (error) {
    next(error);
  }
});
