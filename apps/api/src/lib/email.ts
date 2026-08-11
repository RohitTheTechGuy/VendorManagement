import { Resend } from "resend";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

interface InviteEmailParams {
  to: string;
  orgName: string;
  requirementTitle: string;
  link: string;
}

function inviteHtml({ orgName, requirementTitle, link }: InviteEmailParams): string {
  return `
    <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#172033">
      <p>You've been invited by <strong>${orgName}</strong> to onboard for
         <strong>${requirementTitle}</strong>.</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none">Begin onboarding</a></p>
      <p style="color:#64748b;font-size:14px">Or paste this link: ${link}<br/>This link expires in 14 days.</p>
    </div>`;
}

// Sends the invite via Resend. Returns true if actually sent, false if it was
// only logged (no API key, or a send failure). NEVER throws — a broken email
// provider must not break invite dispatch.
export async function sendInviteEmail(params: InviteEmailParams): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    logger.info({ to: params.to, link: params.link }, "[invite] RESEND_API_KEY not set — magic link logged instead of emailed");
    return false;
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM,
      to: params.to,
      subject: `Invitation from ${params.orgName}: ${params.requirementTitle}`,
      html: inviteHtml(params),
    });
    if (error) {
      logger.error({ err: error, to: params.to, link: params.link }, "[invite] Resend returned an error — magic link logged instead");
      return false;
    }
    return true;
  } catch (error) {
    logger.error({ err: error, to: params.to, link: params.link }, "[invite] Resend threw — magic link logged instead");
    return false;
  }
}
