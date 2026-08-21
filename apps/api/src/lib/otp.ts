import crypto from "node:crypto";
import { OTP_LENGTH } from "@vendor-management/shared";

// Email-OTP policy, in one place so the routes read declaratively.
export const OTP_TTL_MS = 10 * 60 * 1000; // a code is valid for 10 minutes
export const MAX_ATTEMPTS = 5; // wrong-code guesses before the code is dead
export const RESEND_COOLDOWN_MS = 60 * 1000; // minimum gap between sends
export const MAX_RESENDS = 5; // total resends allowed per pending signup

/** A cryptographically-random, zero-padded numeric code of OTP_LENGTH digits. */
export function generateCode(): string {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

/** sha256 hex of a code — only the hash is ever persisted, never the code. */
export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Timing-safe check of a candidate code against a stored hash. */
export function codeMatches(code: string, codeHash: string): boolean {
  const a = Buffer.from(hashCode(code), "hex");
  const b = Buffer.from(codeHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Expiry timestamp for a freshly issued code. */
export function expiryFromNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + OTP_TTL_MS);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() < now.getTime();
}

export function attemptsExceeded(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}

export function resendsExceeded(resendCount: number): boolean {
  return resendCount >= MAX_RESENDS;
}

/** Seconds still to wait before a resend is allowed (0 = allowed now). */
export function resendWaitSeconds(lastSentAt: Date, now: Date = new Date()): number {
  const remaining = RESEND_COOLDOWN_MS - (now.getTime() - lastSentAt.getTime());
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
