import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import type { JwtClaims } from "../lib/auth.js";
import { requireBuyer, requireVendor, requireRole } from "./authz.js";

function mockReqRes(user?: Partial<JwtClaims>) {
  const req = { user } as unknown as Request;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const next = vi.fn();
  return { req, res: res as unknown as Response & { statusCode: number }, next };
}

const buyerOwner: Partial<JwtClaims> = { userId: "u1", orgId: "o1", userType: "BUYER", role: "OWNER" };
const buyerQuality: Partial<JwtClaims> = { userId: "u2", orgId: "o1", userType: "BUYER", role: "QUALITY" };
const buyerFinance: Partial<JwtClaims> = { userId: "u3", orgId: "o1", userType: "BUYER", role: "FINANCE" };
const vendor: Partial<JwtClaims> = { userId: "v1", orgId: null, userType: "VENDOR", role: null };

describe("requireBuyer", () => {
  it("lets a buyer through", () => {
    const { req, res, next } = mockReqRes(buyerOwner);
    requireBuyer(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("403s a vendor token", () => {
    const { req, res, next } = mockReqRes(vendor);
    requireBuyer(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("401s when unauthenticated", () => {
    const { req, res, next } = mockReqRes(undefined);
    requireBuyer(req, res, next);
    expect(res.statusCode).toBe(401);
  });
});

describe("requireVendor", () => {
  it("lets a vendor through and 403s a buyer", () => {
    const ok = mockReqRes(vendor);
    requireVendor(ok.req, ok.res, ok.next);
    expect(ok.next).toHaveBeenCalledOnce();

    const bad = mockReqRes(buyerOwner);
    requireVendor(bad.req, bad.res, bad.next);
    expect(bad.next).not.toHaveBeenCalled();
    expect(bad.res.statusCode).toBe(403);
  });
});

describe("requireRole", () => {
  it("lets the matching role through", () => {
    const { req, res, next } = mockReqRes(buyerFinance);
    requireRole("FINANCE")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("403s a different role (quality cannot action a finance task)", () => {
    const { req, res, next } = mockReqRes(buyerQuality);
    requireRole("FINANCE")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("403s a vendor", () => {
    const { req, res, next } = mockReqRes(vendor);
    requireRole("FINANCE", "QUALITY")(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});
