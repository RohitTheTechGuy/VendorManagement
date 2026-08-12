import crypto from "node:crypto";
import { Router } from "express";
import {
  redeemInviteSchema,
  setVendorPasswordSchema,
  type RedeemInviteInput,
  type SetVendorPasswordInput,
  type RedeemResult,
} from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { AUTH_COOKIE, authCookieOptions, hashPassword, signToken } from "../lib/auth.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireVendor } from "../middleware/authz.js";
import { validateBody } from "../middleware/validate.js";
import { transition } from "../lib/link-state.js";

export const inviteRouter = Router();

// Public: redeem a magic-link token. The token itself is the credential — a
// valid, unexpired token authenticates the vendor and (first time) creates the
// account + link and moves it into pre-qualification. Redeeming twice just logs
// in again; it never duplicates the link.
inviteRouter.post("/redeem", validateBody(redeemInviteSchema), async (req, res, next) => {
  try {
    const { token } = req.body as RedeemInviteInput;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: { requirement: { select: { title: true } } },
    });
    if (!invitation) {
      res.status(400).json({ error: "This invite link is not valid." });
      return;
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "This invite link has expired. Ask the buyer to resend it." });
      return;
    }

    const vendor = await prisma.$transaction(async (tx) => {
      const v = await tx.appUser.upsert({
        where: { email: invitation.email },
        update: {},
        create: { email: invitation.email, userType: "VENDOR" },
      });

      let link = await tx.vendorBuyerLink.findUnique({ where: { candidateId: invitation.candidateId } });
      if (!link) {
        link = await tx.vendorBuyerLink.create({
          data: {
            candidateId: invitation.candidateId,
            requirementId: invitation.requirementId,
            orgId: invitation.orgId,
            vendorUserId: v.id,
            state: "INVITED",
            stage: "PREQUAL",
          },
        });
      } else if (!link.vendorUserId) {
        link = await tx.vendorBuyerLink.update({
          where: { id: link.id },
          data: { vendorUserId: v.id, stage: link.stage ?? "PREQUAL" },
        });
      }

      if (!invitation.openedAt) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: "OPENED", openedAt: new Date() },
        });
      }
      await tx.candidate.update({
        where: { id: invitation.candidateId },
        data: { inviteStatus: "OPENED" },
      });

      // First engagement moves INVITED -> PREQUAL_IN_PROGRESS.
      if (link.state === "INVITED") {
        await transition(
          link.id,
          "PREQUAL_IN_PROGRESS",
          { actorType: "VENDOR", actorId: v.id, side: "VENDOR", note: "Invite redeemed" },
          tx,
        );
      }

      return { user: v, linkId: link.id };
    });

    // Establish the vendor session.
    const jwt = signToken({ userId: vendor.user.id, orgId: null, userType: "VENDOR", role: null });
    res.cookie(AUTH_COOKIE, jwt, authCookieOptions);

    const result: RedeemResult = {
      needsPassword: !vendor.user.passwordHash,
      linkId: vendor.linkId,
      requirementTitle: invitation.requirement.title,
      email: invitation.email,
    };
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Complete a new vendor account by setting its first password.
inviteRouter.post(
  "/set-password",
  requireAuth,
  requireVendor,
  validateBody(setVendorPasswordSchema),
  async (req, res, next) => {
    try {
      const { password } = req.body as SetVendorPasswordInput;
      const user = await prisma.appUser.findUnique({ where: { id: req.user!.userId } });
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (user.passwordHash) {
        res.status(409).json({ error: "A password is already set. Please sign in." });
        return;
      }
      await prisma.appUser.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);
