import { describe, it, expect } from "vitest";
import { sendInviteEmail, sendOtpEmail } from "./email.js";

describe("sendInviteEmail", () => {
  it("returns false and does not throw when RESEND_API_KEY is absent (logs instead)", async () => {
    // No RESEND_API_KEY in the test env — the link is logged, not sent.
    const sent = await sendInviteEmail({
      to: "vendor@example.test",
      orgName: "Meridian Motors",
      requirementTitle: "Forged steering knuckles",
      link: "http://localhost:5173/invite/test-token",
    });
    expect(sent).toBe(false);
  });
});

describe("sendOtpEmail", () => {
  it("returns false and does not throw when RESEND_API_KEY is absent (logs the code instead)", async () => {
    const sent = await sendOtpEmail({ to: "owner@example.test", code: "123456" });
    expect(sent).toBe(false);
  });
});
