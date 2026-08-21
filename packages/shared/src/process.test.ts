import { describe, it, expect } from "vitest";
import { PROCESS_OPTIONS } from "./process.js";
import { PROCESS_CATEGORIES } from "./requirement.js";

describe("process taxonomy", () => {
  it("requirement categories and vendor process tags come from one source", () => {
    // Same reference — a requirement and a vendor describe processes identically,
    // which is what makes vendor↔requirement matching possible.
    expect(PROCESS_CATEGORIES).toBe(PROCESS_OPTIONS);
  });

  it("is the canonical 8-process list", () => {
    expect(PROCESS_OPTIONS).toEqual([
      "HPDC",
      "Gravity Casting",
      "Forging",
      "CNC Turning",
      "VMC",
      "Sheet Metal",
      "Plating",
      "Heat Treatment",
    ]);
  });
});
