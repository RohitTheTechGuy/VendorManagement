import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth.js";

describe("auth lib", () => {
  it("hashes a password and verifies it (rejecting wrong ones)", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).not.toBe("Password123!");
    expect(await verifyPassword("Password123!", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("signs a JWT and verifies its claims round-trip", () => {
    const token = signToken({ userId: "user-1", orgId: "org-1", userType: "BUYER", role: "OWNER" });
    expect(verifyToken(token)).toEqual({
      userId: "user-1",
      orgId: "org-1",
      userType: "BUYER",
      role: "OWNER",
    });
  });

  it("round-trips a vendor token (null orgId and role)", () => {
    const token = signToken({ userId: "vendor-1", orgId: null, userType: "VENDOR", role: null });
    expect(verifyToken(token)).toEqual({
      userId: "vendor-1",
      orgId: null,
      userType: "VENDOR",
      role: null,
    });
  });

  it("rejects a tampered or malformed token", () => {
    expect(() => verifyToken("not.a.valid.jwt")).toThrow();
  });
});
