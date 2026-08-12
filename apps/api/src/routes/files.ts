import { Router } from "express";
import { prisma } from "@vendor-management/db";
import { requireAuth } from "../middleware/require-auth.js";

export const filesRouter = Router();
filesRouter.use(requireAuth);

// A blob's owner is whoever owns the Document or ContractVersion that references
// it. A buyer owns their org's links; a vendor owns their own link. A blob not
// yet attached to anything is not downloadable (the uploader still holds the
// local copy until it is saved).
filesRouter.get("/:id", async (req, res, next) => {
  try {
    const user = req.user!;
    const fileBlobId = req.params.id;

    const doc = await prisma.document.findFirst({
      where: { fileBlobId },
      select: {
        fileName: true,
        mimeType: true,
        link: { select: { orgId: true, vendorUserId: true } },
      },
    });
    const version = doc
      ? null
      : await prisma.contractVersion.findFirst({
          where: { fileBlobId },
          select: {
            fileName: true,
            link: { select: { orgId: true, vendorUserId: true } },
          },
        });
    // A comment may carry a marked-up attachment (vendor redline).
    const comment = doc || version
      ? null
      : await prisma.contractComment.findFirst({
          where: { fileBlobId },
          select: {
            fileName: true,
            link: { select: { orgId: true, vendorUserId: true } },
          },
        });

    const link = doc?.link ?? version?.link ?? comment?.link;
    if (!link) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const owns =
      user.userType === "BUYER" ? link.orgId === user.orgId : link.vendorUserId === user.userId;
    if (!owns) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // The ONLY query that selects file_blob.data.
    const blob = await prisma.fileBlob.findUnique({
      where: { id: fileBlobId },
      select: { data: true },
    });
    if (!blob) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const buffer = Buffer.from(blob.data, "base64");
    const fileName = doc?.fileName ?? version?.fileName ?? comment?.fileName ?? "file";
    const mimeType = doc?.mimeType ?? "application/pdf"; // contract versions are always PDF
    const disposition = req.query.download === "1" ? "attachment" : "inline";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `${disposition}; filename="${fileName.replace(/"/g, "")}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});
