import type { ContractState, Prisma } from "@prisma/client";
import { prisma } from "@vendor-management/db";
import { checkJoinGate } from "./join-gate.js";
import { transition } from "./link-state.js";

// Each contract is an independent state machine. Legal moves are validated
// against this table; no route sets a contract state without going through it.
export const CONTRACT_TRANSITIONS: Record<ContractState, ContractState[]> = {
  DRAFT_PENDING: ["DRAFT_UPLOADED"],
  DRAFT_UPLOADED: ["CHANGES_REQUESTED", "AGREED"],
  VENDOR_REVIEW: ["CHANGES_REQUESTED", "AGREED"],
  CHANGES_REQUESTED: ["REVISED"],
  REVISED: ["CHANGES_REQUESTED", "AGREED"],
  AGREED: ["AWAITING_SIGNATURES"],
  AWAITING_SIGNATURES: ["PARTIALLY_EXECUTED", "EXECUTED"],
  PARTIALLY_EXECUTED: ["EXECUTED"],
  EXECUTED: [],
};

export class IllegalContractTransitionError extends Error {
  constructor(
    public readonly from: ContractState,
    public readonly to: ContractState,
  ) {
    super(`Illegal contract transition: ${from} -> ${to}`);
    this.name = "IllegalContractTransitionError";
  }
}

export function assertContractTransition(from: ContractState, to: ContractState): void {
  if (!CONTRACT_TRANSITIONS[from]?.includes(to)) throw new IllegalContractTransitionError(from, to);
}

type Tx = Prisma.TransactionClient;

/** Next version number for a contract (immutable, ever-incrementing). */
export async function nextVersionNo(tx: Tx, contractId: string): Promise<number> {
  const last = await tx.contractVersion.findFirst({
    where: { contractId },
    orderBy: { versionNo: "desc" },
    select: { versionNo: true },
  });
  return (last?.versionNo ?? 0) + 1;
}

/**
 * Recompute a contract's execution state from the signed versions that exist:
 * both sides signed → EXECUTED, one side → PARTIALLY_EXECUTED, neither →
 * AWAITING_SIGNATURES. Signed versions only accumulate, so this only advances.
 */
export async function recomputeExecution(tx: Tx, contractId: string): Promise<ContractState> {
  const versions = await tx.contractVersion.findMany({
    where: { contractId },
    select: { kind: true },
  });
  const vendorSigned = versions.some((v) => v.kind === "VENDOR_SIGNED");
  const buyerSigned = versions.some((v) => v.kind === "BUYER_SIGNED");

  const target: ContractState = vendorSigned && buyerSigned
    ? "EXECUTED"
    : vendorSigned || buyerSigned
      ? "PARTIALLY_EXECUTED"
      : "AWAITING_SIGNATURES";

  const contract = await tx.contract.findUniqueOrThrow({
    where: { id: contractId },
    select: { state: true },
  });
  if (target !== contract.state) {
    assertContractTransition(contract.state, target);
    await tx.contract.update({
      where: { id: contractId },
      data: { state: target, executedAt: target === "EXECUTED" ? new Date() : null },
    });
  }
  return target;
}

/**
 * If a link's join gate is now open (all four approved AND all six executed),
 * advance it to APPROVED. Safe to call after any contract or approval change.
 */
export async function advanceLinkIfGateOpen(linkId: string): Promise<void> {
  const link = await prisma.vendorBuyerLink.findUnique({ where: { id: linkId }, select: { state: true } });
  if (link?.state !== "CONTRACTS_IN_PROGRESS") return;
  if (await checkJoinGate(linkId)) {
    await transition(linkId, "APPROVED", {
      actorType: "SYSTEM",
      side: "SYSTEM",
      note: "All approvals granted and all contracts executed",
    });
  }
}
