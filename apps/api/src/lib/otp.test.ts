import { describe, it, expect } from "vitest";
import { OTP_LENGTH } from "@vendor-management/shared";
import {
  generateCode,
  hashCode,
  codeMatches,
  expiryFromNow,
  isExpired,
  attemptsExceeded,
  resendsExceeded,
  resendWaitSeconds,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  MAX_RESENDS,
  RESEND_COOLDOWN_MS,
} from "./otp.js";

const CODE_RE = new RegExp(`^\\d{${OTP_LENGTH}}$`);

describe("generateCode", () => {
  it("always produces a zero-padded numeric code of OTP_LENGTH digits", () => {
    for (let i = 0; i < 500; i++) expect(generateCode()).toMatch(CODE_RE);
  });
});

describe("hashCode / codeMatches", () => {
  it("stores a sha256 hash, never the code, and matches only the right code", () => {
    const hash = hashCode("123456");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("123456");
    expect(codeMatches("123456", hash)).toBe(true);
    expect(codeMatches("654321", hash)).toBe(false);
  });

  it("returns false for a malformed/short stored hash instead of throwing", () => {
    expect(codeMatches("123456", "deadbeef")).toBe(false);
  });
});

describe("expiry", () => {
  it("expiryFromNow is exactly OTP_TTL_MS ahead and not yet expired", () => {
    const now = new Date("2026-08-21T00:00:00Z");
    const exp = expiryFromNow(now);
    expect(exp.getTime() - now.getTime()).toBe(OTP_TTL_MS);
    expect(isExpired(exp, now)).toBe(false);
  });

  it("isExpired flips once the moment passes", () => {
    const exp = new Date("2026-08-21T00:00:00Z");
    expect(isExpired(exp, new Date("2026-08-21T00:00:01Z"))).toBe(true);
  });
});

describe("throttle helpers", () => {
  it("caps attempts and resends at their limits", () => {
    expect(attemptsExceeded(MAX_ATTEMPTS - 1)).toBe(false);
    expect(attemptsExceeded(MAX_ATTEMPTS)).toBe(true);
    expect(resendsExceeded(MAX_RESENDS - 1)).toBe(false);
    expect(resendsExceeded(MAX_RESENDS)).toBe(true);
  });

  it("counts down the resend cooldown and reaches 0 after it elapses", () => {
    const last = new Date("2026-08-21T00:00:00Z");
    expect(resendWaitSeconds(last, last)).toBe(RESEND_COOLDOWN_MS / 1000);
    expect(resendWaitSeconds(last, new Date(last.getTime() + 30_000))).toBe(30);
    expect(resendWaitSeconds(last, new Date(last.getTime() + RESEND_COOLDOWN_MS))).toBe(0);
  });
});
