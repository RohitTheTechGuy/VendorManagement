import type { ActorSide, LinkState, Prisma } from "@prisma/client";
import { prisma } from "@vendor-management/db";
import { syncRequirementStage } from "./requirement-stage.js";

/**
 * The single source of truth for legal link transitions.
 *
 * Every change to `VendorBuyerLink.state` MUST go through `transition()`, which
 * validates the move against this table, writes an append-only `LinkEvent`, and
 * updates the state — all in one DB transaction. No route sets `state` directly.
 *
 * Reading the table: `FROM: [ ...allowed TO states ]`. A state whose array is
 * empty is terminal (no further moves). This keeps illegal or duplicate
 * transitions — the #1 bug source across the two interfaces — impossible.
 */
export const LINK_TRANSITIONS: Record<LinkState, LinkState[]> = {
  // --- Happy path -----------------------------------------------------------
  INVITED: ["PREQUAL_IN_PROGRESS", "EXPIRED", "WITHDRAWN"],
  PREQUAL_IN_PROGRESS: ["PREQUAL_SUBMITTED", "WITHDRAWN", "EXPIRED"],
  // Buyer opens the submission to review it, or sends it back to be fixed.
  PREQUAL_SUBMITTED: ["PREQUAL_UNDER_REVIEW", "PREQUAL_IN_PROGRESS"],
  // Clear, send back for changes (hard-fail verification), reject, or hold.
  PREQUAL_UNDER_REVIEW: ["PREQUAL_CLEARED", "PREQUAL_IN_PROGRESS", "REJECTED", "ON_HOLD"],
  PREQUAL_CLEARED: ["AWARDED", "ON_HOLD"],
  AWARDED: ["FULL_IN_PROGRESS"],
  FULL_IN_PROGRESS: ["FULL_SUBMITTED", "WITHDRAWN"],
  FULL_SUBMITTED: ["FULL_UNDER_REVIEW", "FULL_IN_PROGRESS"],
  FULL_UNDER_REVIEW: ["CONTRACTS_IN_PROGRESS", "FULL_IN_PROGRESS", "REJECTED", "ON_HOLD"],
  // Approvals + contract redline live here; a request-changes can reopen the pack.
  CONTRACTS_IN_PROGRESS: ["APPROVED", "FULL_IN_PROGRESS", "ON_HOLD"],
  APPROVED: ["ERP_SYNCING"],
  ERP_SYNCING: ["ONBOARDED", "ERP_FAILED"],
  ONBOARDED: [],

  // --- Terminals ------------------------------------------------------------
  REJECTED: [],
  ON_HOLD: [], // modelled as terminal for now; resume is not yet a flow
  WITHDRAWN: [],
  ERP_FAILED: ["ERP_SYNCING"], // retry the push (Phase 18)
  EXPIRED: [],
};

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: LinkState,
    public readonly to: LinkState,
  ) {
    super(`Illegal link transition: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export class LinkNotFoundError extends Error {
  constructor(public readonly linkId: string) {
    super(`Link not found: ${linkId}`);
    this.name = "LinkNotFoundError";
  }
}

export function isLegalTransition(from: LinkState, to: LinkState): boolean {
  return LINK_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Who caused a transition — recorded verbatim on the LinkEvent. */
export interface TransitionActor {
  actorType: ActorSide; // VENDOR | BUYER | SYSTEM
  actorId?: string | null;
  side?: ActorSide; // defaults to actorType
  note?: string | null;
}

// A Prisma client that can be either the root client or a transaction client —
// so callers can run transition() standalone OR inside a bigger transaction
// (award, contract execution) that must be atomic.
type PrismaLike = Prisma.TransactionClient | typeof prisma;

async function applyTransition(
  db: PrismaLike,
  linkId: string,
  toState: LinkState,
  actor: TransitionActor,
) {
  const link = await db.vendorBuyerLink.findUnique({
    where: { id: linkId },
    select: { id: true, state: true, requirementId: true },
  });
  if (!link) throw new LinkNotFoundError(linkId);

  const from = link.state;
  if (!isLegalTransition(from, toState)) throw new IllegalTransitionError(from, toState);

  // Append-only audit row first, then the state update — same transaction.
  await db.linkEvent.create({
    data: {
      linkId,
      fromState: from,
      toState,
      actorType: actor.actorType,
      actorId: actor.actorId ?? null,
      side: actor.side ?? actor.actorType,
      note: actor.note ?? null,
    },
  });

  const updated = await db.vendorBuyerLink.update({
    where: { id: linkId },
    data: { state: toState, currentStateSince: new Date() },
  });

  // Keep the parent requirement's coarse stage in step with link activity.
  await syncRequirementStage(db, link.requirementId);

  return updated;
}

/**
 * Move a link to `toState`, validating and logging the change atomically.
 *
 * Pass `existingTx` to run inside a caller's transaction (e.g. award, which
 * also creates contracts and review tasks); omit it to run standalone in its
 * own transaction.
 *
 * @throws IllegalTransitionError if the move is not in the transition table.
 * @throws LinkNotFoundError if the link id does not exist.
 */
export function transition(
  linkId: string,
  toState: LinkState,
  actor: TransitionActor,
  existingTx?: Prisma.TransactionClient,
) {
  if (existingTx) return applyTransition(existingTx, linkId, toState, actor);
  return prisma.$transaction((tx) => applyTransition(tx, linkId, toState, actor));
}
