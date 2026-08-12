import crypto from "node:crypto";
import { prisma } from "@vendor-management/db";
import { FILE_CONSTRAINTS, type UploadKind, type UploadResult } from "@vendor-management/shared";

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

interface IncomingFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

/**
 * Validate an uploaded file server-side (never trust the client), then store it
 * as base64 in FileBlob and return light metadata. This is the ONLY place bytes
 * are written into a blob.
 */
export async function storeUpload(kind: UploadKind, file: IncomingFile): Promise<UploadResult> {
  const limits = FILE_CONSTRAINTS[kind];
  if (!limits) throw new FileValidationError("Unknown upload kind");
  if (!limits.mimeTypes.includes(file.mimetype)) {
    throw new FileValidationError(`Unsupported file type "${file.mimetype}" for a ${kind}`);
  }
  if (file.size > limits.maxBytes) {
    const mb = Math.round(limits.maxBytes / (1024 * 1024));
    throw new FileValidationError(`File is larger than the ${mb} MB limit for a ${kind}`);
  }

  const data = file.buffer.toString("base64");
  const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const blob = await prisma.fileBlob.create({ data: { data, sha256 }, select: { id: true } });

  return {
    fileBlobId: blob.id,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256,
  };
}
