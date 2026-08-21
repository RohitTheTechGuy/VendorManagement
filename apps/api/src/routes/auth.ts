import { Router } from "express";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
  type AuthUser,
  type RegisterInput,
  type LoginInput,
  type VerifyEmailInput,
  type ResendOtpInput,
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
import {
  generateCode,
  hashCode,
  codeMatches,
  expiryFromNow,
  isExpired,
  attemptsExceeded,
  resendsExceeded,
  resendWaitSeconds,
  MAX_ATTEMPTS,
} from "../lib/otp.js";
import { sendOtpEmail } from "../lib/email.js";
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

// Step 1 of registration: hold the signup and email a one-time code. The org +
// OWNER account are NOT created here — only once the code is verified — so a
// typo'd or unowned email never yields a real account. Re-registering the same
// email upserts the pending row (fresh code, counters reset).
authRouter.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, orgName } = req.body as RegisterInput;

    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const code = generateCode();
    const fields = { codeHash: hashCode(code), passwordHash, fullName, orgName, expiresAt: expiryFromNow() };
    await prisma.emailVerification.upsert({
      where: { email },
      create: { email, ...fields },
      update: { ...fields, attempts: 0, resendCount: 0, lastSentAt: new Date() },
    });

    await sendOtpEmail({ to: email, code });
    res.status(200).json({ needsVerification: true, email });
  } catch (error) {
    next(error);
  }
});

// Step 2: verify the code, then create the org + OWNER and start the session.
authRouter.post("/verify-email", validateBody(verifyEmailSchema), async (req, res, next) => {
  try {
    const { email, code } = req.body as VerifyEmailInput;

    const pending = await prisma.emailVerification.findUnique({ where: { email } });
    if (!pending) {
      res.status(400).json({ error: "No verification is pending for this email. Please register again." });
      return;
    }
    if (isExpired(pending.expiresAt)) {
      res.status(400).json({ error: "This code has expired. Request a new one." });
      return;
    }
    if (attemptsExceeded(pending.attempts)) {
      res.status(429).json({ error: "Too many incorrect attempts. Request a new code." });
      return;
    }
    if (!codeMatches(code, pending.codeHash)) {
      const attempts = pending.attempts + 1;
      await prisma.emailVerification.update({ where: { email }, data: { attempts } });
      const left = Math.max(0, MAX_ATTEMPTS - attempts);
      res.status(400).json({
        error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Incorrect code. Request a new one.",
      });
      return;
    }

    // Correct code. Re-check the email is still free (race), then create the org +
    // owner and clear the pending row in one transaction, and issue the session.
    const taken = await prisma.appUser.findUnique({ where: { email } });
    if (taken) {
      await prisma.emailVerification.delete({ where: { email } }).catch(() => undefined);
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const { user, orgId } = await prisma.$transaction(async (tx) => {
      const org = await tx.buyerOrg.create({ data: { legalName: pending.orgName } });
      const created = await tx.appUser.create({
        data: {
          email: pending.email,
          passwordHash: pending.passwordHash,
          fullName: pending.fullName,
          orgId: org.id,
          userType: "BUYER",
          role: "OWNER",
        },
      });
      await tx.emailVerification.delete({ where: { email } });
      return { user: created, orgId: org.id };
    });

    const token = signToken({ userId: user.id, orgId, userType: "BUYER", role: "OWNER" });
    res.cookie(AUTH_COOKIE, token, authCookieOptions);
    res.status(201).json({ user: toAuthUser(user) });
  } catch (error) {
    next(error);
  }
});

// Resend a code — throttled by a per-email cooldown and a total-resend cap.
authRouter.post("/resend-otp", validateBody(resendOtpSchema), async (req, res, next) => {
  try {
    const { email } = req.body as ResendOtpInput;

    const pending = await prisma.emailVerification.findUnique({ where: { email } });
    if (!pending) {
      res.status(400).json({ error: "No verification is pending for this email. Please register again." });
      return;
    }
    if (resendsExceeded(pending.resendCount)) {
      res.status(429).json({ error: "Too many codes requested. Please register again later." });
      return;
    }
    const wait = resendWaitSeconds(pending.lastSentAt);
    if (wait > 0) {
      res.status(429).json({ error: `Please wait ${wait}s before requesting another code.` });
      return;
    }

    const code = generateCode();
    await prisma.emailVerification.update({
      where: { email },
      data: {
        codeHash: hashCode(code),
        expiresAt: expiryFromNow(),
        attempts: 0,
        resendCount: pending.resendCount + 1,
        lastSentAt: new Date(),
      },
    });
    await sendOtpEmail({ to: email, code });
    res.status(200).json({ ok: true });
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
