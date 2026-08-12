import { describe, it, expect } from "vitest";
import {
  CONTRACT_TRANSITIONS,
  assertContractTransition,
  IllegalContractTransitionError,
} from "./contract-state.js";

describe("contract state machine", () => {
  it("allows the redline happy path step by step", () => {
    const path = [
      ["DRAFT_PENDING", "DRAFT_UPLOADED"],
      ["DRAFT_UPLOADED", "CHANGES_REQUESTED"],
      ["CHANGES_REQUESTED", "REVISED"],
      ["REVISED", "AGREED"],
      ["AGREED", "AWAITING_SIGNATURES"],
      ["AWAITING_SIGNATURES", "PARTIALLY_EXECUTED"],
      ["PARTIALLY_EXECUTED", "EXECUTED"],
    ] as const;
    for (const [from, to] of path) {
      expect(() => assertContractTransition(from, to)).not.toThrow();
    }
  });

  it("blocks skipping straight to executed or signing before agreed", () => {
    expect(() => assertContractTransition("DRAFT_PENDING", "EXECUTED")).toThrow(IllegalContractTransitionError);
    expect(() => assertContractTransition("DRAFT_UPLOADED", "AWAITING_SIGNATURES")).toThrow(
      IllegalContractTransitionError,
    );
  });

  it("cannot revise unless changes were requested", () => {
    expect(() => assertContractTransition("DRAFT_UPLOADED", "REVISED")).toThrow(IllegalContractTransitionError);
    expect(() => assertContractTransition("CHANGES_REQUESTED", "REVISED")).not.toThrow();
  });

  it("EXECUTED is terminal", () => {
    expect(CONTRACT_TRANSITIONS.EXECUTED).toEqual([]);
  });
});
