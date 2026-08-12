import { describe, it, expect } from "vitest";
import { storeUpload, FileValidationError } from "./files.js";

// These cases are rejected by validation BEFORE any DB write, so no database is
// needed. The happy path (which writes a FileBlob) is covered by the live
// end-to-end verification.
function file(overrides: Partial<{ mimetype: string; size: number }> = {}) {
  return {
    buffer: Buffer.from("x"),
    mimetype: overrides.mimetype ?? "application/pdf",
    size: overrides.size ?? 1024,
    originalname: "test.pdf",
  };
}

describe("storeUpload validation", () => {
  it("rejects a disallowed MIME type for a document", async () => {
    await expect(storeUpload("document", file({ mimetype: "application/zip" }))).rejects.toBeInstanceOf(
      FileValidationError,
    );
  });

  it("rejects a non-PDF for a contract", async () => {
    await expect(storeUpload("contract", file({ mimetype: "image/png" }))).rejects.toBeInstanceOf(
      FileValidationError,
    );
  });

  it("rejects a document over 5MB", async () => {
    await expect(storeUpload("document", file({ size: 6 * 1024 * 1024 }))).rejects.toBeInstanceOf(
      FileValidationError,
    );
  });

  it("rejects a contract over 10MB", async () => {
    await expect(storeUpload("contract", file({ size: 11 * 1024 * 1024 }))).rejects.toBeInstanceOf(
      FileValidationError,
    );
  });
});
