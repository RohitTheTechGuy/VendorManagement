import { describe, it, expect } from "vitest";
import { APPROVER_ROLES } from "@vendor-management/shared";
import { BUYER_ROUTES, BUYER_NAV, canAccess, buyerHome } from "./route-access.js";

describe("canAccess", () => {
  it("lets OWNER open OWNER-only routes but blocks approvers", () => {
    expect(canAccess("OWNER", ["OWNER"])).toBe(true);
    expect(canAccess("QUALITY", ["OWNER"])).toBe(false);
  });

  it("lets approvers open approver routes but blocks OWNER", () => {
    for (const r of APPROVER_ROLES) expect(canAccess(r, APPROVER_ROLES)).toBe(true);
    expect(canAccess("OWNER", APPROVER_ROLES)).toBe(false);
  });

  it("lets any signed-in buyer through an ALL_BUYERS route", () => {
    expect(canAccess("OWNER", "ALL_BUYERS")).toBe(true);
    expect(canAccess("LEGAL", "ALL_BUYERS")).toBe(true);
    expect(canAccess(null, "ALL_BUYERS")).toBe(true);
  });

  it("denies a missing role on a role-restricted route", () => {
    expect(canAccess(null, ["OWNER"])).toBe(false);
    expect(canAccess(undefined, APPROVER_ROLES)).toBe(false);
  });
});

describe("buyerHome", () => {
  it("routes OWNER home to '/' and approvers to '/approvals'", () => {
    expect(buyerHome("OWNER")).toBe("/");
    for (const r of APPROVER_ROLES) expect(buyerHome(r)).toBe("/approvals");
  });

  it("falls back to '/activity' for an unknown/absent role", () => {
    expect(buyerHome(null)).toBe("/activity");
    expect(buyerHome("MYSTERY")).toBe("/activity");
  });

  it("never sends a role to a page that role cannot access (no redirect loop)", () => {
    const rolesFor = (path: string) => BUYER_ROUTES.find((r) => r.path === path)!.roles;
    for (const role of ["OWNER", ...APPROVER_ROLES, "MYSTERY", null]) {
      expect(canAccess(role, rolesFor(buyerHome(role)))).toBe(true);
    }
  });
});

describe("BUYER_NAV", () => {
  it("lists only routes with nav metadata, in manifest order", () => {
    expect(BUYER_NAV.map((r) => r.nav.label)).toEqual([
      "Requirements",
      "Directory",
      "Team",
      "Approvals",
      "Activity",
    ]);
  });

  it("shows OWNER four links and an approver two", () => {
    const linksFor = (role: string) =>
      BUYER_NAV.filter((r) => canAccess(role, r.roles)).map((r) => r.nav.label);
    expect(linksFor("OWNER")).toEqual(["Requirements", "Directory", "Team", "Activity"]);
    expect(linksFor("QUALITY")).toEqual(["Approvals", "Activity"]);
  });
});
