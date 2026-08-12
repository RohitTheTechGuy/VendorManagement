import { prisma } from "@vendor-management/db";
import type { LinkState, LinkStage, VendorLinkDTO } from "@vendor-management/shared";
import { computeDualTat } from "./tat.js";
import { CONTRACT_INCLUDE, mapContract } from "./contract-dto.js";

/**
 * Build the vendor-facing view of a link: current-stage field values + this
 * stage's documents (metadata only — never file bytes) + requirement context.
 */
export async function loadVendorLinkDTO(linkId: string): Promise<VendorLinkDTO | null> {
  const link = await prisma.vendorBuyerLink.findUnique({
    where: { id: linkId },
    include: {
      requirement: {
        select: {
          id: true,
          title: true,
          processCategories: true,
          owner: { select: { fullName: true, email: true } },
        },
      },
      org: { select: { legalName: true } },
      submissions: { include: { fieldValues: true } },
      documents: { orderBy: { uploadedAt: "asc" } },
      events: { orderBy: { occurredAt: "asc" }, select: { toState: true, occurredAt: true } },
      contracts: { include: CONTRACT_INCLUDE, orderBy: { contractType: "asc" } },
    },
  });
  if (!link) return null;

  const stage = link.stage;
  const submission = stage ? link.submissions.find((s) => s.stage === stage) : undefined;

  const fields: Record<string, string> = {};
  if (submission) {
    for (const fv of submission.fieldValues) {
      if (fv.value != null) fields[fv.fieldKey] = fv.value;
    }
  }

  // Only show documents belonging to the current stage's submission.
  const documents = link.documents
    .filter((d) => (submission ? d.submissionId === submission.id : d.submissionId == null))
    .map((d) => ({
      id: d.id,
      checklistItemKey: d.checklistItemKey,
      fileBlobId: d.fileBlobId,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      status: d.status,
      rejectionReason: d.rejectionReason,
      uploadedAt: d.uploadedAt.toISOString(),
    }));

  // TAT timeline: link starts at INVITED on createdAt, then each event's toState.
  const points = [
    { at: link.createdAt, state: "INVITED" as LinkState },
    ...link.events.map((e) => ({ at: e.occurredAt, state: e.toState as LinkState })),
  ];

  return {
    id: link.id,
    state: link.state as LinkState,
    stage: link.stage as LinkStage | null,
    requirement: {
      id: link.requirement.id,
      title: link.requirement.title,
      processCategories: link.requirement.processCategories,
      buyerOrgName: link.org.legalName,
    },
    buyerContact: {
      name: link.requirement.owner.fullName,
      email: link.requirement.owner.email,
    },
    fields,
    documents,
    contracts: link.contracts.map(mapContract),
    prequalScore: link.prequalScore,
    erpVendorCode: link.erpVendorCode,
    tat: computeDualTat(points),
    createdAt: link.createdAt.toISOString(),
  };
}

/** Get or create the submission row for a link's current stage. */
export async function ensureSubmission(linkId: string, stage: LinkStage) {
  const existing = await prisma.submission.findUnique({
    where: { linkId_stage: { linkId, stage } },
  });
  if (existing) return existing;
  return prisma.submission.create({ data: { linkId, stage, status: "IN_PROGRESS" } });
}
