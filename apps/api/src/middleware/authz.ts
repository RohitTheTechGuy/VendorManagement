import type { Request, RequestHandler } from "express";
import type { BuyerRole } from "@prisma/client";
import { prisma } from "@vendor-management/db";

// Authorization middleware set. Every non-public route composes `requireAuth`
// (which attaches req.user) with the right combination of these. A vendor must
// never reach a buyer route or another vendor's data; an approver of one role
// must not action another role's task.
//
// All of these assume `requireAuth` ran first; if req.user is missing they 401.

const unauthorized: RequestHandler = (_req, res) => {
  res.status(401).json({ error: "Unauthorized" });
};

const forbidden: RequestHandler = (_req, res) => {
  res.status(403).json({ error: "Forbidden" });
};

/**
 * The org id of the current buyer. Safe to call only after `requireBuyer` has
 * run — a buyer always has an org, so this narrows the nullable JWT claim to a
 * plain string for org-scoped queries. Throws if misused on a non-buyer route.
 */
export function buyerOrgId(req: Request): string {
  const orgId = req.user?.orgId;
  if (req.user?.userType !== "BUYER" || !orgId) {
    throw new Error("buyerOrgId() requires a buyer context (mount requireBuyer first)");
  }
  return orgId;
}

/** Caller must be a buyer (any buyer role). */
export const requireBuyer: RequestHandler = (req, res, next) => {
  if (!req.user) return unauthorized(req, res, next);
  if (req.user.userType !== "BUYER") return forbidden(req, res, next);
  next();
};

/** Caller must be a vendor. */
export const requireVendor: RequestHandler = (req, res, next) => {
  if (!req.user) return unauthorized(req, res, next);
  if (req.user.userType !== "VENDOR") return forbidden(req, res, next);
  next();
};

/**
 * Caller must be a buyer holding one of the given roles. Used to keep, say, a
 * finance approver out of a quality task.
 */
export function requireRole(...roles: BuyerRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) return unauthorized(req, res, next);
    if (req.user.userType !== "BUYER" || !req.user.role || !roles.includes(req.user.role)) {
      return forbidden(req, res, next);
    }
    next();
  };
}

/**
 * Caller must own the link named by a route param (default `:id`): a vendor may
 * only touch their own link; a buyer may only touch a link in their own org.
 * On success the link (id, orgId, vendorUserId, state) is attached as req.link.
 */
export function requireOwnLink(paramName = "id"): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.user) return unauthorized(req, res, next);
      const raw = req.params[paramName];
      const linkId = Array.isArray(raw) ? raw[0] : raw;
      if (!linkId) {
        res.status(400).json({ error: "Missing link id" });
        return;
      }

      const link = await prisma.vendorBuyerLink.findUnique({
        where: { id: linkId },
        select: { id: true, orgId: true, vendorUserId: true, state: true },
      });
      if (!link) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const owns =
        req.user.userType === "BUYER"
          ? link.orgId === req.user.orgId
          : link.vendorUserId === req.user.userId;
      if (!owns) return forbidden(req, res, next);

      req.link = link;
      next();
    } catch (error) {
      next(error);
    }
  };
}
