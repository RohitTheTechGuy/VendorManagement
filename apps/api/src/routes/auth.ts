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
  userType: "BUYER" | "VENDOR";
  role: string | null;
  orgId: string | null;
}

function toAuthUser(user: UserRow): AuthUser {
  // Explicit projection — the password hash never leaves the server. Vendors
  // carry a null orgId/role; buyers always have both.
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    userType: user.userType,
    role: user.role,
    orgId: user.orgId,
  };
}

authRouter.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, orgName } = req.body as RegisterInput;

    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    // Org + first user are created together or not at all. The first user of an
    // org is a buyer OWNER.
    const { user, orgId } = await prisma.$transaction(async (tx) => {
      const org = await tx.buyerOrg.create({ data: { legalName: orgName } });
      const created = await tx.appUser.create({
        data: { email, passwordHash, fullName, orgId: org.id, userType: "BUYER", role: "OWNER" },
      });
      return { user: created, orgId: org.id };
    });

    const token = signToken({ userId: user.id, orgId, userType: "BUYER", role: "OWNER" });
    res.cookie(AUTH_COOKIE, token, authCookieOptions);
    res.status(201).json({ user: toAuthUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as LoginInput;

    // One login for both sides. A vendor account only has a password once it has
    // redeemed a magic link (Phase 11); until then passwordHash is null.
    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: GENERIC_BAD_CREDENTIALS });
      return;
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: GENERIC_BAD_CREDENTIALS });
      return;
    }

    const token = signToken({
      userId: user.id,
      orgId: user.orgId,
      userType: user.userType,
      role: user.role,
    });
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
    const user = await prisma.appUser.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ user: toAuthUser(user) });
  } catch (error) {
    next(error);
  }
});
