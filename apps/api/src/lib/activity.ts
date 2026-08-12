import { prisma } from "@vendor-management/db";
import {
  LINK_STATE_META,
  CONTRACT_TYPE_LABEL,
  CHECK_META,
  type ActivityItem,
  type LinkState,
  type VerificationCheckType,
} from "@vendor-management/shared";

const CONTRACT_KIND_VERB: Record<string, string> = {
  DRAFT: "uploaded a draft of",
  REVISED: "uploaded a revised",
  VENDOR_SIGNED: "signed",
  BUYER_SIGNED: "signed",
};

/**
 * Build the buyer-side activity feed for an org: a single time-sorted stream
 * merged from link state transitions, approval decisions, contract
 * uploads/signatures, and resolved verification checks. Org-scoped — a buyer
 * only ever sees their own org's links.
 */
export async function buildActivityFeed(orgId: string, limit = 60): Promise<ActivityItem[]> {
  const links = await prisma.vendorBuyerLink.findMany({
    where: { orgId },
    select: {
      id: true,
      candidate: { select: { legalName: true } },
      requirement: { select: { title: true } },
    },
  });
  if (links.length === 0) return [];

  const meta = new Map(
    links.map((l) => [l.id, { vendorName: l.candidate.legalName, requirementTitle: l.requirement.title }]),
  );
  const linkIds = links.map((l) => l.id);
  const label = (linkId: string) => meta.get(linkId)!;

  const [events, decisions, versions, checks] = await Promise.all([
    prisma.linkEvent.findMany({
      where: { linkId: { in: linkIds } },
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
    prisma.approvalDecision.findMany({
      where: { linkId: { in: linkIds } },
      include: { reviewTask: { select: { role: true } } },
      orderBy: { decidedAt: "desc" },
      take: limit,
    }),
    prisma.contractVersion.findMany({
      where: { linkId: { in: linkIds } },
      include: { contract: { select: { contractType: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.verificationCheck.findMany({
      where: { linkId: { in: linkIds }, status: { not: "RUNNING" }, ranAt: { not: null } },
      orderBy: { ranAt: "desc" },
      take: limit,
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const e of events) {
    const m = label(e.linkId);
    items.push({
      id: `evt-${e.id}`,
      at: e.occurredAt.toISOString(),
      side: e.side === "VENDOR" ? "vendor" : e.side === "SYSTEM" ? "system" : "buyer",
      category: "lifecycle",
      vendorName: m.vendorName,
      requirementTitle: m.requirementTitle,
      description: e.note ?? LINK_STATE_META[e.toState as LinkState].label,
    });
  }

  for (const d of decisions) {
    const m = label(d.linkId);
    const verb = d.decision === "APPROVED" ? "approved" : "requested changes on";
    items.push({
      id: `dec-${d.id}`,
      at: d.decidedAt.toISOString(),
      side: "buyer",
      category: "approval",
      vendorName: m.vendorName,
      requirementTitle: m.requirementTitle,
      description: `${d.reviewTask.role} ${verb} the review${d.comment ? ` — “${d.comment}”` : ""}`,
    });
  }

  for (const v of versions) {
    const m = label(v.linkId);
    const who = v.uploadedBySide === "BUYER" ? "Legal" : "Vendor";
    const verb = CONTRACT_KIND_VERB[v.kind] ?? "updated";
    items.push({
      id: `ver-${v.id}`,
      at: v.createdAt.toISOString(),
      side: v.uploadedBySide === "BUYER" ? "buyer" : "vendor",
      category: "contract",
      vendorName: m.vendorName,
      requirementTitle: m.requirementTitle,
      description: `${who} ${verb} the ${CONTRACT_TYPE_LABEL[v.contract.contractType]}`,
    });
  }

  for (const c of checks) {
    const m = label(c.linkId);
    items.push({
      id: `chk-${c.id}`,
      at: (c.ranAt ?? c.createdAt).toISOString(),
      side: "buyer",
      category: "verification",
      vendorName: m.vendorName,
      requirementTitle: m.requirementTitle,
      description: `${CHECK_META[c.checkType as VerificationCheckType].label}: ${c.status.toLowerCase().replace("_", " ")}`,
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, limit);
}
