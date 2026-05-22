// src/services/twinNotificationService.js
//
// "Your digital twin is ready" email notifier.
//
// Called from the ingestion-status controller: every time the dashboard
// polls /ingestion-status, we check whether the AI engine reports the
// twin as ready AND we have not yet emailed the user. If both are true,
// we send the email and stamp `aiReadyEmailSentAt` on the DigitalTwin
// doc so the next poll is a no-op.
//
// This is intentionally NOT triggered from create/save flows, because
// twin readiness depends on async ingestion (resume embedding, website
// crawl) that can take 1-5 minutes after the structured profile is
// saved. The status poll is the natural choke point that's already
// running anyway.

import DigitalTwin from "../models/DigitalTwin.js";
import User from "../models/User.js";
import mailer from "./mailer.js";

/**
 * If the AI engine reports the twin as ready and we haven't already
 * notified the user, send the "twin ready" email and mark it sent.
 *
 * `aiStatus` is the body of GET /v1/tenants/{tid}/status (passed through
 * from the ingestion-status controller — we already have it in hand so
 * the caller doesn't pay for a second AI-backend call).
 *
 * Returns `{ emailed: boolean, reason: string }` for observability.
 */
export const maybeSendTwinReadyEmail = async ({ twin, aiStatus }) => {
  if (!twin) return { emailed: false, reason: "no-twin" };
  if (twin.aiReadyEmailSentAt) return { emailed: false, reason: "already-sent" };

  // "ready" requires the AI engine to have at least the structured profile
  // indexed. Resume/website are optional sources — a twin with only the
  // wizard form is still "ready" for chat.
  const overall = aiStatus?.overall_status;
  if (overall !== "ready") return { emailed: false, reason: `not-ready (${overall || "unknown"})` };

  // We need the user's registered email — twin doc only carries a ref.
  // Use .lean() because we only read.
  const user = await User.findById(twin.user).select("name email").lean();
  if (!user?.email) {
    return { emailed: false, reason: "user-missing-email" };
  }

  const displayName = twin.identity?.name || user.name || "there";
  const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "");
  const dashboardLink = frontendUrl ? `${frontendUrl}/dashboard` : null;
  const liveLink = frontendUrl ? `${frontendUrl}/chatbot/${twin._id}` : null;
  const readySources = Array.isArray(aiStatus?.ready_sources)
    ? aiStatus.ready_sources
    : [];

  const subject = `Your NetTwin digital twin is ready, ${displayName}`;
  const html = _renderHtml({ displayName, dashboardLink, liveLink, readySources });

  const result = await mailer.send({
    to: user.email,
    subject,
    html,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
  });

  if (result.sent || result.dryRun) {
    // Stamp the field in both real-send and dry-run cases. Rationale:
    //   * Real send: obvious — don't email twice.
    //   * Dry run (no SMTP): we already logged the intent; stamping
    //     prevents the log from screaming on every 4s poll until SMTP
    //     is wired. Operator can clear the field manually to retry.
    twin.aiReadyEmailSentAt = new Date();
    await twin.save();
    return {
      emailed: result.sent,
      reason: result.sent ? "ok" : "dry-run",
    };
  }

  // Real send failed (SMTP error, etc.) — do NOT stamp the field so the
  // next poll retries automatically. We rely on idempotency over time
  // rather than a manual retry queue.
  return { emailed: false, reason: "send-failed" };
};

// ─────────────────────────────────────────────────────────── HTML template
const _renderHtml = ({ displayName, dashboardLink, liveLink, readySources }) => {
  const sourcesLine = readySources.length
    ? `Indexed sources: ${readySources.map((s) => s[0].toUpperCase() + s.slice(1)).join(", ")}.`
    : "";

  const button = (label, href, primary = false) =>
    href
      ? `<a href="${href}" style="display:inline-block;margin:6px 4px;padding:12px 22px;border-radius:12px;${
          primary
            ? "background:linear-gradient(90deg,#06B6D4,#2DD4BF);color:#fff;"
            : "background:#0F2237;color:#67E8F9;border:1px solid rgba(103,232,249,0.3);"
        }text-decoration:none;font-weight:600;font-family:Arial,Helvetica,sans-serif;font-size:14px;">${label}</a>`
      : "";

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0A1929;font-family:Arial,Helvetica,sans-serif;color:#E2E8F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A1929;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0D2137;border:1px solid rgba(34,211,238,0.2);border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#67E8F9;font-weight:600;">NetTwin</div>
          <h1 style="margin:8px 0 16px 0;font-size:24px;line-height:1.3;color:#fff;font-weight:700;">
            Your digital twin is live, ${_esc(displayName)}.
          </h1>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#CBD5E1;">
            We finished indexing everything you uploaded — resume, website, and your structured profile. Visitors who scan your QR code will now get answers grounded in <em>your</em> data, not generic AI guesses.
          </p>
          ${
            sourcesLine
              ? `<p style="margin:0 0 24px 0;font-size:14px;color:#94A3B8;">${_esc(sourcesLine)}</p>`
              : ""
          }
          <div style="margin:24px 0 8px 0;">
            ${button("Open Dashboard", dashboardLink, true)}
            ${button("View Live Twin", liveLink)}
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 28px 32px;border-top:1px solid rgba(34,211,238,0.12);">
          <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#94A3B8;">
            What's next?
          </p>
          <ul style="margin:0 0 0 18px;padding:0;font-size:13px;line-height:1.7;color:#CBD5E1;">
            <li>Share the QR from your dashboard at events, on LinkedIn, or anywhere people want to learn about you.</li>
            <li>Drop in to the dashboard any time to add or replace sources — your chatbot updates in minutes.</li>
            <li>Replies are limited to facts from your profile, so it won't make things up.</li>
          </ul>
        </td></tr>
        <tr><td style="padding:16px 32px 24px 32px;border-top:1px solid rgba(34,211,238,0.12);">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#64748B;">
            You're getting this because you created a digital twin on NetTwin. Need help? Just reply to this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const _esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
