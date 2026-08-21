import { describe, it, expect } from "vitest";
import type { DirectoryVendor } from "@vendor-management/shared";
import { matchVendors } from "./vendor-match.js";

function vendor(over: Partial<DirectoryVendor>): DirectoryVendor {
  return {
    id: Math.random().toString(),
    legalName: "V",
    pan: null,
    primaryGstin: null,
    contactEmail: "v@example.com",
    city: null,
    state: null,
    processTags: [],
    certificationTags: [],
    badgeState: "VERIFIED",
    ...over,
  };
}

describe("matchVendors", () => {
  it("returns nothing until a process is chosen", () => {
    const v = vendor({ processTags: ["CNC Turning"] });
    expect(matchVendors([v], { processCategories: [] })).toEqual([]);
  });

  it("includes only vendors sharing at least one process, with the shared tags", () => {
    const acme = vendor({ legalName: "Acme", processTags: ["CNC Turning", "VMC"] });
    const zeta = vendor({ legalName: "Zeta", processTags: ["Plating"] });
    const out = matchVendors([acme, zeta], { processCategories: ["CNC Turning"] });
    expect(out.map((m) => m.vendor.legalName)).toEqual(["Acme"]);
    expect(out[0].sharedProcesses).toEqual(["CNC Turning"]);
  });

  it("ranks by number of shared processes first", () => {
    const one = vendor({ legalName: "One", processTags: ["CNC Turning"] });
    const two = vendor({ legalName: "Two", processTags: ["CNC Turning", "VMC"] });
    const out = matchVendors([one, two], { processCategories: ["CNC Turning", "VMC"] });
    expect(out.map((m) => m.vendor.legalName)).toEqual(["Two", "One"]);
  });

  it("prefers VERIFIED over LISTED over STALE at equal share count", () => {
    const listed = vendor({ legalName: "L", processTags: ["VMC"], badgeState: "LISTED" });
    const verified = vendor({ legalName: "V", processTags: ["VMC"], badgeState: "VERIFIED" });
    const stale = vendor({ legalName: "S", processTags: ["VMC"], badgeState: "STALE" });
    const out = matchVendors([listed, stale, verified], { processCategories: ["VMC"] });
    expect(out.map((m) => m.vendor.badgeState)).toEqual(["VERIFIED", "LISTED", "STALE"]);
  });

  it("boosts vendors whose city/state appears in the plant-location text", () => {
    const near = vendor({ legalName: "Near", processTags: ["Forging"], city: "Manesar" });
    const far = vendor({ legalName: "Far", processTags: ["Forging"], city: "Pune" });
    const out = matchVendors([far, near], {
      processCategories: ["Forging"],
      location: "Manesar Plant 1",
    });
    expect(out.map((m) => m.vendor.legalName)).toEqual(["Near", "Far"]);
  });
});
