import "express";
import type { JwtClaims } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth after verifying the JWT.
      user?: JwtClaims;
    }
  }
}
