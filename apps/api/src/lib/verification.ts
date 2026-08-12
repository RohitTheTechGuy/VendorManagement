import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@vendor-management/db";
import { CHECK_SUBJECT_FIELD, type VerificationCheckType } from "@vendor-management/shared";

// How long a check "runs" before it resolves — a real async lifecycle the
// client watches flip via polling.
export const CHECK_RESOLVE_MS = 1600;

// Result validity window once a check resolves.
const CHECK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

interface Resolution {
  status: "PASSED" | "FAILED" | "NEEDS_REVIEW";
  matchScore: number;
  detail: Record<string, unknown>;
}

/**
 * Deterministic mock of an external verification. The same subject always
 * yields the same outcome. Roughly 70% pass, 20% need review (name band),
 * 10% hard-fail — driven by a hash of (checkType, subject).
 */
export function resolveCheck(checkType: VerificationCheckType | string, subject: string): Resolution {
  const s = (subject ?? "").trim().toUpperCase();
  if (!s) {
    return { status: "NEEDS_REVIEW", matchScore: 0, detail: { reason: "No value on file to verify" } };
  }
  const digest = crypto.createHash("sha256").update(`${checkType}:${s}`).digest();
  const bucket = digest[0] % 10;
  if (bucket === 0) {
    return { status: "FAILED", matchScore: 40 + (digest[1] % 15), detail: { reason: "No matching record found" } };
  }
  if (bucket === 1 || bucket === 2) {
    return {
      status: "NEEDS_REVIEW",
      matchScore: 65 + (digest[1] % 12),
      detail: { reason: "Registered name partially matches (name band)" },
    };
  }
  return { status: "PASSED", matchScore: 88 + (digest[1] % 12), detail: { reason: "Verified against source" } };
}

/** The subject value a check verifies, read from merged submission fields. */
export function subjectForCheck(checkType: VerificationCheckType, fields: Record<string, string>): string {
  return fields[CHECK_SUBJECT_FIELD[checkType]] ?? "";
}

/**
 * Resolve any RUNNING checks on a link whose delay has elapsed. Idempotent and
 * restart-safe — called both by a timer after a check is triggered and lazily
 * whenever the buyer reads the link, so results flip without a live timer.
 */
export async function resolveDueChecks(linkId: string): Promise<void> {
  const running = await prisma.verificationCheck.findMany({
    where: { linkId, status: "RUNNING" },
  });
  const now = Date.now();
  for (const c of running) {
    if (c.ranAt && now - c.ranAt.getTime() >= CHECK_RESOLVE_MS) {
      const r = resolveCheck(c.checkType, c.subjectValue ?? "");
      await prisma.verificationCheck.update({
        where: { id: c.id },
        data: {
          status: r.status,
          matchScore: r.matchScore,
          detail: r.detail as Prisma.InputJsonValue,
          expiresAt: new Date(now + CHECK_TTL_MS),
        },
      });
    }
  }
}
