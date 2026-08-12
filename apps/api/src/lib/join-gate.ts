import { prisma } from "@vendor-management/db";

// The number of parallel approvals and contracts a link must complete.
const REQUIRED_APPROVALS = 4;
const REQUIRED_CONTRACTS = 6;

/**
 * The single source of truth for whether a link may advance to APPROVED: all
 * four review tasks approved AND all six contracts executed. Called after every
 * approval and every contract change so no route computes the gate on its own.
 */
export async function checkJoinGate(linkId: string): Promise<boolean> {
  const [approvedTasks, totalTasks, executedContracts, totalContracts] = await Promise.all([
    prisma.reviewTask.count({ where: { linkId, status: "APPROVED" } }),
    prisma.reviewTask.count({ where: { linkId } }),
    prisma.contract.count({ where: { linkId, state: "EXECUTED" } }),
    prisma.contract.count({ where: { linkId } }),
  ]);

  const allApproved = totalTasks === REQUIRED_APPROVALS && approvedTasks === REQUIRED_APPROVALS;
  const allExecuted = totalContracts === REQUIRED_CONTRACTS && executedContracts === REQUIRED_CONTRACTS;
  return allApproved && allExecuted;
}
