import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { CookieOptions } from "express";
import { env } from "../config/env.js";

const BCRYPT_COST = 12;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const AUTH_COOKIE = "token";

export interface JwtClaims {
  userId: string;
  orgId: string;
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
    typeof decoded.orgId !== "string"
  ) {
    throw new Error("Invalid token payload");
  }
  return { userId: decoded.userId, orgId: decoded.orgId };
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
