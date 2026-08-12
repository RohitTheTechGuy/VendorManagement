import type { Prisma } from "@prisma/client";

// Grows the shared directory pool from the onboarding pipeline (PRD §5.8 / §7):
// an onboarded winner becomes VERIFIED; the other candidates that cleared
// pre-qualification but weren't awarded become LISTED ("warm"). Both callers
// run inside an existing transaction, so these take a TransactionClient.

type Tx = Prisma.TransactionClient;

// The fields a Candidate carries that map onto a DirectoryVendor. Candidate has
// no process/certification tags, so onboarding-derived entries start with none.
const CANDIDATE_SELECT = {
  legalName: true,
  contactEmail: true,
  pan: true,
  gstin: true,
  city: true,
  state: true,
} as const;

interface VendorIdentity {
  legalName: string;
  contactEmail: string;
  pan: string | null;
  primaryGstin: string | null;
  city: string | null;
  state: string | null;
}

function toIdentity(c: {
  legalName: string;
  contactEmail: string;
  pan: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
}): VendorIdentity {
  return {
    legalName: c.legalName,
    contactEmail: c.contactEmail,
    pan: c.pan,
    primaryGstin: c.gstin,
    city: c.city,
    state: c.state,
  };
}

/**
 * Add a vendor to the directory, deduped by contact email (case-insensitive —
 * the one identity every candidate and directory row always has). Badges only
 * ever move up: a VERIFIED push upgrades an existing LISTED/STALE entry, but a
 * LISTED push never downgrades a VERIFIED one, and never creates a duplicate.
 */
async function upsertDirectoryVendor(tx: Tx, v: VendorIdentity, badge: "VERIFIED" | "LISTED"): Promise<void> {
  const existing = await tx.directoryVendor.findFirst({
    where: { contactEmail: { equals: v.contactEmail, mode: "insensitive" } },
    select: { id: true, badgeState: true },
  });

  if (!existing) {
    await tx.directoryVendor.create({ data: { ...v, badgeState: badge } });
    return;
  }

  if (badge === "VERIFIED" && existing.badgeState !== "VERIFIED") {
    await tx.directoryVendor.update({ where: { id: existing.id }, data: { badgeState: "VERIFIED" } });
  }
}

/** The onboarded vendor on `linkId` joins the directory as VERIFIED. */
export async function promoteOnboardedToDirectory(tx: Tx, linkId: string): Promise<void> {
  const link = await tx.vendorBuyerLink.findUnique({
    where: { id: linkId },
    select: { candidate: { select: CANDIDATE_SELECT } },
  });
  if (!link?.candidate) return;
  await upsertDirectoryVendor(tx, toIdentity(link.candidate), "VERIFIED");
}

/**
 * Every candidate on `requirementId` still sitting in PREQUAL_CLEARED — cleared
 * pre-qualification but not awarded — is listed as a warm lead. Call this after
 * the winner has already been transitioned to AWARDED, so it's excluded.
 */
export async function listWarmCandidates(tx: Tx, requirementId: string): Promise<void> {
  const warm = await tx.vendorBuyerLink.findMany({
    where: { requirementId, state: "PREQUAL_CLEARED" },
    select: { candidate: { select: CANDIDATE_SELECT } },
  });
  for (const w of warm) {
    if (!w.candidate) continue;
    await upsertDirectoryVendor(tx, toIdentity(w.candidate), "LISTED");
  }
}
