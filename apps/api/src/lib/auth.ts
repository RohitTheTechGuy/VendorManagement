import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { CookieOptions } from "express";
import type { BuyerRole, UserType } from "@prisma/client";
import { env } from "../config/env.js";

const BCRYPT_COST = 12;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const AUTH_COOKIE = "token";

// The claims we sign into the JWT. userType + role drive authorization on every
// route (see middleware/authz.ts). orgId is null for vendors; role is null for
// vendors (and could be any BuyerRole for buyers).
export interface JwtClaims {
  userId: string;
  orgId: string | null;
  userType: UserType;
  role: BuyerRole | null;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(claims: JwtClaims): string {
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyToken(token: string): JwtClaims {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (
    typeof decoded === "string" ||
    typeof decoded.userId !== "string" ||
    (decoded.orgId !== null && typeof decoded.orgId !== "string") ||
    (decoded.userType !== "BUYER" && decoded.userType !== "VENDOR") ||
    (decoded.role !== null && typeof decoded.role !== "string")
  ) {
    throw new Error("Invalid token payload");
  }
  return {
    userId: decoded.userId,
    orgId: decoded.orgId,
    userType: decoded.userType,
    role: (decoded.role as BuyerRole | null) ?? null,
  };
}

// httpOnly so JS can't read it; sameSite=lax for normal navigation; secure in prod.
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  maxAge: TOKEN_TTL_SECONDS * 1000,
  path: "/",
};

export const clearCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
};
