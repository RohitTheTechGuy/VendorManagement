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
    const token = signToken({ userId: "user-1", orgId: "org-1" });
    expect(verifyToken(token)).toEqual({ userId: "user-1", orgId: "org-1" });
  });

  it("rejects a tampered or malformed token", () => {
    expect(() => verifyToken("not.a.valid.jwt")).toThrow();
  });
});
