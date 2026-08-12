import { prisma } from "@vendor-management/db";
import type {
  BuyerLinkDetail,
  LinkState,
  LinkStage,
  VerificationCheckType,
  VerificationStatus,
} from "@vendor-management/shared";
import { checkJoinGate } from "./join-gate.js";
import { CONTRACT_INCLUDE, mapContract } from "./contract-dto.js";

/** Merged field values across all of a link's submissions (for verification subjects). */
export async function mergedFields(linkId: string): Promise<Record<string, string>> {
  const subs = await prisma.submission.findMany({
    where: { linkId },
    include: { fieldValues: true },
  });
  const fields: Record<string, string> = {};
  for (const s of subs) {
    for (const fv of s.fieldValues) if (fv.value != null) fields[fv.fieldKey] = fv.value;
  }
  return fields;
}

/** The full buyer-facing view of one link (drawer). Never selects blob bytes. */
export async function loadBuyerLinkDetail(linkId: string): Promise<BuyerLinkDetail | null> {
  const link = await prisma.vendorBuyerLink.findUnique({
    where: { id: linkId },
    include: {
      candidate: true,
      requirement: { select: { id: true, title: true, processCategories: true } },
      submissions: { include: { fieldValues: true, documents: { orderBy: { uploadedAt: "asc" } } } },
      verificationChecks: { orderBy: { createdAt: "asc" } },
      reviewTasks: {
        include: {
          assignedUser: { select: { email: true } },
          decisions: { orderBy: { decidedAt: "desc" }, take: 1 },
        },
        orderBy: { role: "asc" },
      },
      contracts: { include: CONTRACT_INCLUDE, orderBy: { contractType: "asc" } },
    },
  });
  if (!link) return null;

  // Merge field values + documents across stages (later stages win on conflict).
  const fields: Record<string, string> = {};
  const documents = [];
  for (const s of link.submissions) {
    for (const fv of s.fieldValues) if (fv.value != null) fields[fv.fieldKey] = fv.value;
    for (const d of s.documents) {
      documents.push({
        id: d.id,
        checklistItemKey: d.checklistItemKey,
        fileBlobId: d.fileBlobId,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        status: d.status,
        rejectionReason: d.rejectionReason,
        uploadedAt: d.uploadedAt.toISOString(),
      });
    }
  }

  const contracts = link.contracts.map(mapContract);

  return {
    id: link.id,
    state: link.state as LinkState,
    stage: link.stage as LinkStage | null,
    prequalScore: link.prequalScore,
    erpVendorCode: link.erpVendorCode,
    candidate: {
      legalName: link.candidate.legalName,
      contactEmail: link.candidate.contactEmail,
      contactPhone: link.candidate.contactPhone,
      city: link.candidate.city,
      state: link.candidate.state,
    },
    requirement: {
      id: link.requirement.id,
      title: link.requirement.title,
      processCategories: link.requirement.processCategories,
    },
    fields,
    documents,
    checks: link.verificationChecks.map((c) => ({
      id: c.id,
      checkType: c.checkType as VerificationCheckType,
      subjectValue: c.subjectValue,
      status: c.status as VerificationStatus,
      matchScore: c.matchScore,
      detail: c.detail ?? null,
      ranAt: c.ranAt ? c.ranAt.toISOString() : null,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    })),
    reviewTasks: link.reviewTasks.map((t) => ({
      id: t.id,
      role: t.role as "QUALITY" | "FINANCE" | "TAX" | "LEGAL",
      status: t.status,
      assignedUserEmail: t.assignedUser?.email ?? null,
      lastComment: t.decisions[0]?.comment ?? null,
    })),
    contracts,
    joinGateOpen: await checkJoinGate(link.id),
  };
}
