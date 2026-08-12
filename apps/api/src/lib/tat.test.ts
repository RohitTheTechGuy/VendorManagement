import { describe, it, expect } from "vitest";
import { computeDualTat } from "./tat.js";
import { generateVendorCode } from "./erp.js";

describe("computeDualTat", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("attributes each segment to the right side's court", () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    // 2 days in PREQUAL_IN_PROGRESS (vendor), then 1 day under review (buyer).
    const points = [
      { at: t0, state: "PREQUAL_IN_PROGRESS" as const },
      { at: new Date(t0.getTime() + 2 * DAY), state: "PREQUAL_UNDER_REVIEW" as const },
    ];
    const now = new Date(t0.getTime() + 3 * DAY);
    const tat = computeDualTat(points, now);
    expect(tat.vendorPendingDays).toBeCloseTo(2, 5);
    expect(tat.buyerPendingDays).toBeCloseTo(1, 5);
  });

  it("counts neither side while ONBOARDED (done)", () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    const points = [{ at: t0, state: "ONBOARDED" as const }];
    const tat = computeDualTat(points, new Date(t0.getTime() + 5 * DAY));
    expect(tat.vendorPendingDays).toBe(0);
    expect(tat.buyerPendingDays).toBe(0);
  });
});

describe("generateVendorCode", () => {
  it("is deterministic and shaped 0001 + 6 digits", () => {
    const code = generateVendorCode("some-link-id");
    expect(code).toMatch(/^0001\d{6}$/);
    expect(generateVendorCode("some-link-id")).toBe(code);
    expect(generateVendorCode("other-link-id")).not.toBe(code);
  });
});
