import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { promoteOnboardedToDirectory, listWarmCandidates } from "./directory-sync.js";

const CANDIDATE = {
  legalName: "Rohit Mahadev",
  contactEmail: "Rohit@Example.com",
  pan: "ABCDE1234F",
  gstin: "27ABCDE1234F1Z5",
  city: "Pune",
  state: "MH",
};

// A fake transaction client that records directoryVendor writes, with a
// configurable existing-row lookup so we can exercise the dedup/upgrade rules
// without a database.
function fakeTx(opts: {
  existing?: { id: string; badgeState: string } | null;
  warmCandidates?: { candidate: typeof CANDIDATE }[];
}) {
  const findFirst = vi.fn().mockResolvedValue(opts.existing ?? null);
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const linkFindUnique = vi.fn().mockResolvedValue({ candidate: CANDIDATE });
  const linkFindMany = vi.fn().mockResolvedValue(opts.warmCandidates ?? []);
  const tx = {
    directoryVendor: { findFirst, create, update },
    vendorBuyerLink: { findUnique: linkFindUnique, findMany: linkFindMany },
  } as unknown as Prisma.TransactionClient;
  return { tx, findFirst, create, update, linkFindMany };
}

describe("promoteOnboardedToDirectory (onboarded → VERIFIED)", () => {
  it("creates a VERIFIED entry when the vendor isn't in the directory", async () => {
    const { tx, create } = fakeTx({ existing: null });
    await promoteOnboardedToDirectory(tx, "link-1");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      legalName: "Rohit Mahadev",
      primaryGstin: "27ABCDE1234F1Z5", // Candidate.gstin maps to primaryGstin
      badgeState: "VERIFIED",
    });
  });

  it("upgrades an existing LISTED (warm) entry to VERIFIED", async () => {
    const { tx, create, update } = fakeTx({ existing: { id: "dir-1", badgeState: "LISTED" } });
    await promoteOnboardedToDirectory(tx, "link-1");
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data).toEqual({ badgeState: "VERIFIED" });
  });

  it("is a no-op when the vendor is already VERIFIED (no duplicate, no rewrite)", async () => {
    const { tx, create, update } = fakeTx({ existing: { id: "dir-1", badgeState: "VERIFIED" } });
    await promoteOnboardedToDirectory(tx, "link-1");
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("listWarmCandidates (prequal-cleared, not awarded → LISTED)", () => {
  it("lists each cleared sibling as LISTED", async () => {
    const { tx, create } = fakeTx({
      existing: null,
      warmCandidates: [
        { candidate: { ...CANDIDATE, contactEmail: "y@example.com" } },
        { candidate: { ...CANDIDATE, contactEmail: "z@example.com" } },
      ],
    });
    await listWarmCandidates(tx, "req-1");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data.badgeState).toBe("LISTED");
  });

  it("never downgrades a vendor already VERIFIED in the pool", async () => {
    const { tx, create, update } = fakeTx({
      existing: { id: "dir-1", badgeState: "VERIFIED" },
      warmCandidates: [{ candidate: CANDIDATE }],
    });
    await listWarmCandidates(tx, "req-1");
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("does nothing when there are no cleared siblings", async () => {
    const { tx, create } = fakeTx({ warmCandidates: [] });
    await listWarmCandidates(tx, "req-1");
    expect(create).not.toHaveBeenCalled();
  });
});
