import "express";
import type { LinkState } from "@prisma/client";
import type { JwtClaims } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth after verifying the JWT.
      user?: JwtClaims;
      // Set by requireOwnLink after verifying the caller owns the link.
      link?: {
        id: string;
        orgId: string;
        vendorUserId: string | null;
        state: LinkState;
      };
    }
  }
}
