import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

// These exercise the Zod validation layer (validateBody), which rejects before
// any database access — so they run without a DB. The DB-backed happy paths
// (create-on-verify, throttling) are covered by manual end-to-end verification.
describe("auth OTP endpoints — request validation", () => {
  it("rejects register with a too-short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "owner@example.test", password: "short", fullName: "Owner", orgName: "Acme" });
    expect(res.status).toBe(400);
  });

  it("rejects verify-email when the code is not 6 digits", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "owner@example.test", code: "12" });
    expect(res.status).toBe(400);
  });

  it("rejects verify-email with a non-numeric code", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "owner@example.test", code: "abcdef" });
    expect(res.status).toBe(400);
  });

  it("rejects resend-otp with an invalid email", async () => {
    const res = await request(app).post("/api/auth/resend-otp").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});
