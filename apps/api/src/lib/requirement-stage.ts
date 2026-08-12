import type { Prisma } from "@prisma/client";
import { prisma } from "@vendor-management/db";

type Db = Prisma.TransactionClient | typeof prisma;

// Link states that mean a candidate is actively engaged (past the invite, not
// terminal, not yet onboarded) — enough to call the requirement "In progress".
const ACTIVE_LINK_STATES = [
  "PREQUAL_IN_PROGRESS",
  "PREQUAL_SUBMITTED",
  "PREQUAL_UNDER_REVIEW",
  "PREQUAL_CLEARED",
  "AWARDED",
  "FULL_IN_PROGRESS",
  "FULL_SUBMITTED",
  "FULL_UNDER_REVIEW",
  "CONTRACTS_IN_PROGRESS",
  "APPROVED",
  "ERP_SYNCING",
  "ERP_FAILED",
] as const;

// Requirement stages that may still auto-advance to IN_PROGRESS.
const PRE_ENGAGEMENT_STAGES = ["DRAFT", "CANDIDATES_SELECTED", "INVITES_SENT"];

/**
 * Keep a requirement's coarse stage in step with its links: CLOSED once a
 * candidate is onboarded, otherwise IN_PROGRESS as soon as one is actively
 * engaged. Idempotent; never reopens a CLOSED requirement.
 */
export async function syncRequirementStage(db: Db, requirementId: string): Promise<void> {
  const req = await db.requirement.findUnique({
    where: { id: requirementId },
    select: { stage: true },
  });
  if (!req) return;

  const onboarded = await db.vendorBuyerLink.count({
    where: { requirementId, state: "ONBOARDED" },
  });
  if (onboarded > 0) {
    if (req.stage !== "CLOSED") {
      await db.requirement.update({ where: { id: requirementId }, data: { stage: "CLOSED" } });
    }
    return;
  }
  if (req.stage === "CLOSED") return;

  const active = await db.vendorBuyerLink.count({
    where: { requirementId, state: { in: [...ACTIVE_LINK_STATES] } },
  });
  if (active > 0 && PRE_ENGAGEMENT_STAGES.includes(req.stage)) {
    await db.requirement.update({ where: { id: requirementId }, data: { stage: "IN_PROGRESS" } });
  }
}
