import { Router } from "express";
import {
  registerSchema,
  loginSchema,
  type AuthUser,
  type RegisterInput,
  type LoginInput,
} from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import {
  AUTH_COOKIE,
  authCookieOptions,
  clearCookieOptions,
  hashPassword,
  verifyPassword,
  signToken,
} from "../lib/auth.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/require-auth.js";

export const authRouter = Router();

// Same message whether the email is unknown or the password is wrong —
// never leak which field was at fault.
const GENERIC_BAD_CREDENTIALS = "Invalid email or password";

interface UserRow {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  orgId: string;
}

function toAuthUser(user: UserRow): AuthUser {
  // Explicit projection — the password hash never leaves the server.
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    orgId: user.orgId,
  };
}

authRouter.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, orgName } = req.body as RegisterInput;

    const existing = await prisma.buyerUser.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    // Org + first user are created together or not at all.
    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.buyerOrg.create({ data: { legalName: orgName } });
      return tx.buyerUser.create({
        data: { email, passwordHash, fullName, orgId: org.id },
      });
    });

    const token = signToken({ userId: user.id, orgId: user.orgId });
    res.cookie(AUTH_COOKIE, token, authCookieOptions);
    res.status(201).json({ user: toAuthUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as LoginInput;

    const user = await prisma.buyerUser.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: GENERIC_BAD_CREDENTIALS });
      return;
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: GENERIC_BAD_CREDENTIALS });
      return;
    }

    const token = signToken({ userId: user.id, orgId: user.orgId });
    res.cookie(AUTH_COOKIE, token, authCookieOptions);
    res.json({ user: toAuthUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, clearCookieOptions);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.buyerUser.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ user: toAuthUser(user) });
  } catch (error) {
    next(error);
  }
});
