import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  LINK_TRANSITIONS,
  isLegalTransition,
  transition,
  IllegalTransitionError,
} from "./link-state.js";

// A minimal fake transaction client that records what transition() does, so we
// can assert behaviour without a database.
function fakeTx(currentState: string) {
  const findUnique = vi.fn().mockResolvedValue({ id: "link-1", state: currentState });
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({ id: "link-1", state: "unused" });
  const tx = {
    vendorBuyerLink: { findUnique, update },
    linkEvent: { create },
  } as unknown as Prisma.TransactionClient;
  return { tx, findUnique, create, update };
}

describe("link-state transition table", () => {
  it("allows the canonical happy-path step and blocks a skip-ahead", () => {
    expect(isLegalTransition("INVITED", "PREQUAL_IN_PROGRESS")).toBe(true);
    expect(isLegalTransition("INVITED", "AWARDED")).toBe(false);
    expect(isLegalTransition("PREQUAL_UNDER_REVIEW", "PREQUAL_CLEARED")).toBe(true);
  });

  it("treats a state as terminal when it has no outgoing transitions", () => {
    expect(LINK_TRANSITIONS.ONBOARDED).toEqual([]);
    expect(isLegalTransition("ONBOARDED", "ERP_SYNCING")).toBe(false);
    expect(isLegalTransition("REJECTED", "PREQUAL_IN_PROGRESS")).toBe(false);
  });

  it("rejects a self-loop (no duplicate transition to the same state)", () => {
    expect(isLegalTransition("AWARDED", "AWARDED")).toBe(false);
  });
});

describe("transition()", () => {
  it("writes an event and updates state on a legal move", async () => {
    const { tx, create, update } = fakeTx("INVITED");

    await transition("link-1", "PREQUAL_IN_PROGRESS", { actorType: "SYSTEM" }, tx);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      linkId: "link-1",
      fromState: "INVITED",
      toState: "PREQUAL_IN_PROGRESS",
      actorType: "SYSTEM",
      side: "SYSTEM", // defaults to actorType
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data.state).toBe("PREQUAL_IN_PROGRESS");
  });

  it("rejects an illegal jump and writes nothing", async () => {
    const { tx, create, update } = fakeTx("INVITED");

    await expect(
      transition("link-1", "ONBOARDED", { actorType: "BUYER" }, tx),
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
