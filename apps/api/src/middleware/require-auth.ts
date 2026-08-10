import type { RequestHandler } from "express";
import { AUTH_COOKIE, verifyToken } from "../lib/auth.js";

// Reads the auth cookie, verifies the JWT, and attaches req.user.
// Returns 401 when the cookie is missing or invalid.
export const requireAuth: RequestHandler = (req, res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};
