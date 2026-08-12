import crypto from "node:crypto";
import { prisma } from "@vendor-management/db";
import { transition } from "./link-state.js";
import { promoteOnboardedToDirectory } from "./directory-sync.js";

// How long the mocked ERP "sync" takes before it resolves.
export const ERP_DELAY_MS = 1800;

// In-memory intent to fail the *current* sync attempt (for demoing the failure
// path + retry). Not persisted — a restart just defaults the attempt to success.
const pendingFail = new Set<string>();

export function markErpSyncToFail(linkId: string): void {
  pendingFail.add(linkId);
}

/** Deterministic fake SAP vendor code: 0001 + 6 digits derived from the link id. */
export function generateVendorCode(linkId: string): string {
  const hash = crypto.createHash("sha256").update(linkId).digest("hex");
  const n = parseInt(hash.slice(0, 12), 16) % 1_000_000;
  return `0001${String(n).padStart(6, "0")}`;
}

/**
 * Resolve a link stuck in ERP_SYNCING once the delay has elapsed. Idempotent
 * and restart-safe — called by a timer and lazily on read. Success stores the
 * vendor code and onboards; a marked attempt fails (retryable).
 */
export async function resolveErpIfDue(linkId: string): Promise<void> {
  const link = await prisma.vendorBuyerLink.findUnique({
    where: { id: linkId },
    select: { state: true, currentStateSince: true, requirementId: true },
  });
  if (!link || link.state !== "ERP_SYNCING") return;
  if (Date.now() - link.currentStateSince.getTime() < ERP_DELAY_MS) return;

  if (pendingFail.has(linkId)) {
    pendingFail.delete(linkId);
    await transition(linkId, "ERP_FAILED", { actorType: "SYSTEM", side: "SYSTEM", note: "ERP sync failed (simulated)" });
    return;
  }

  const code = generateVendorCode(linkId);
  await prisma.$transaction(async (tx) => {
    await tx.vendorBuyerLink.update({
      where: { id: linkId },
      data: { erpVendorCode: code, onboardedAt: new Date() },
    });
    await transition(
      linkId,
      "ONBOARDED",
      { actorType: "SYSTEM", side: "SYSTEM", note: `Onboarded with vendor code ${code}` },
      tx,
    );
    // The requirement is now filled.
    await tx.requirement.update({ where: { id: link.requirementId }, data: { stage: "CLOSED" } });
    // The onboarded vendor joins the shared directory as VERIFIED.
    await promoteOnboardedToDirectory(tx, linkId);
  });
}
