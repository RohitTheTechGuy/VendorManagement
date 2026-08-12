import type { ContractDTO } from "@vendor-management/shared";

// The Prisma shape both loaders fetch: contract + versions (each with comments).
interface ContractWithVersions {
  id: string;
  contractType: ContractDTO["contractType"];
  state: ContractDTO["state"];
  currentVersionId: string | null;
  versions: {
    id: string;
    versionNo: number;
    kind: ContractDTO["versions"][number]["kind"];
    uploadedBySide: ContractDTO["versions"][number]["uploadedBySide"];
    fileBlobId: string;
    fileName: string;
    createdAt: Date;
    comments: { id: string; authorSide: "VENDOR" | "BUYER"; body: string; createdAt: Date }[];
  }[];
}

export const CONTRACT_INCLUDE = {
  versions: {
    orderBy: { versionNo: "asc" as const },
    include: { comments: { orderBy: { createdAt: "asc" as const } } },
  },
} as const;

export function mapContract(c: ContractWithVersions): ContractDTO {
  return {
    id: c.id,
    contractType: c.contractType,
    state: c.state,
    currentVersionId: c.currentVersionId,
    versions: c.versions.map((v) => ({
      id: v.id,
      versionNo: v.versionNo,
      kind: v.kind,
      uploadedBySide: v.uploadedBySide,
      fileBlobId: v.fileBlobId,
      fileName: v.fileName,
      createdAt: v.createdAt.toISOString(),
    })),
    comments: c.versions
      .flatMap((v) => v.comments)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((cm) => ({
        id: cm.id,
        authorSide: cm.authorSide,
        body: cm.body,
        createdAt: cm.createdAt.toISOString(),
      })),
  };
}
