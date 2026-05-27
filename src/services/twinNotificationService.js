// src/services/twinNotificationService.js
//
// Idempotent "your AI digital twin is ready" notifier. It is called from
// both the dashboard polling endpoint and the internal AI-backend completion
// webhook, so all send/retry behavior stays centralized here.

import DigitalTwin from "../models/DigitalTwin.js";
import User from "../models/User.js";
import mailer from "./mailer.js";

const getFrontendUrl = () =>
  (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.NETTWIN_FRONTEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");

/**
 * If the AI engine reports the twin as ready and we have not already notified
 * the owner, send the ready email and stamp `aiReadyEmailSentAt`.
 *
 * Returns `{ emailed: boolean, reason: string }` for webhook/poll observability.
 */
export const maybeSendTwinReadyEmail = async ({ twin, aiStatus }) => {
  if (!twin) return { emailed: false, reason: "no-twin" };
  if (twin.aiReadyEmailSentAt) return { emailed: false, reason: "already-sent" };

  const overall = aiStatus?.overall_status;
  if (overall !== "ready") {
    return { emailed: false, reason: `not-ready (${overall || "unknown"})` };
  }

  const user = await User.findById(twin.user).select("name email").lean();
  if (!user?.email) {
    return { emailed: false, reason: "user-missing-email" };
  }

  const userName = user.name || "there";
  const twinName = twin.identity?.name || user.name || "your digital twin";
  const liveLink = `${getFrontendUrl()}/chatbot/${twin._id}`;
  const readySources = Array.isArray(aiStatus?.ready_sources) ? aiStatus.ready_sources : [];

  const subject = "Your AI Digital Twin is Ready";
  const templateData = { userName, twinName, liveLink, readySources };
  const result = await mailer.send({
    to: user.email,
    subject,
    html: renderTwinReadyHtml(templateData),
    text: renderTwinReadyText(templateData),
    replyTo: process.env.MAIL_REPLY_TO || undefined,
  });

  if (result.sent || result.dryRun) {
    // Real send: don't duplicate. Dry run: prevent repeated local log noise;
    // operators can clear the field manually if they want to retry.
    twin.aiReadyEmailSentAt = new Date();
    await twin.save();
    return {
      emailed: result.sent,
      reason: result.sent ? "ok" : "dry-run",
    };
  }

  // SMTP failed. Do not stamp, so the next poll/webhook retry can send.
  return { emailed: false, reason: "send-failed" };
};

const renderTwinReadyHtml = ({ userName, twinName, liveLink, readySources }) => {
  const sourcesLine = readySources.length
    ? `Indexed sources: ${readySources.map(titleCase).join(", ")}.`
    : "";

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#05050f;font-family:Inter,Arial,Helvetica,sans-serif;color:#E2E8F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05050f;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:linear-gradient(135deg,#0b1120 0%,#111837 48%,#1e1b4b 100%);border:1px solid rgba(139,92,246,0.34);border-radius:24px;overflow:hidden;box-shadow:0 28px 90px rgba(0,0,0,0.45);">
        <tr><td style="padding:34px 30px 10px 30px;">
          <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(34,211,238,0.10);border:1px solid rgba(34,211,238,0.24);color:#67E8F9;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">NetTwin</div>
          <h1 style="margin:18px 0 12px 0;font-size:30px;line-height:1.18;color:#fff;font-weight:800;">Your AI Digital Twin is ready.</h1>
          <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#CBD5E1;">
            Hi ${esc(userName)}, ${esc(twinName)} is live and ready to represent you. We finished processing your profile knowledge so visitors can ask meaningful questions and get grounded answers from your uploaded sources.
          </p>
          ${
            sourcesLine
              ? `<p style="margin:0 0 24px 0;font-size:14px;color:#94A3B8;">${esc(sourcesLine)}</p>`
              : ""
          }
          <div style="margin:26px 0 12px 0;">
            <a href="${esc(liveLink)}" style="display:inline-block;padding:14px 24px;border-radius:14px;background:linear-gradient(90deg,#22d3ee 0%,#3b82f6 52%,#a855f7 100%);color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 12px 32px rgba(59,130,246,0.35);">Open Your Twin</a>
          </div>
        </td></tr>
        <tr><td style="padding:14px 30px 28px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(15,23,42,0.62);border:1px solid rgba(148,163,184,0.18);border-radius:18px;">
            <tr><td style="padding:18px 18px;">
              <p style="margin:0 0 10px 0;font-size:14px;color:#E0F2FE;font-weight:700;">What you can do now</p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#CBD5E1;">Share your live twin from your dashboard, add it to your QR flow, or send it directly to people who want to understand your work, story, and expertise.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 30px 26px 30px;border-top:1px solid rgba(139,92,246,0.22);">
          <p style="margin:0 0 6px 0;font-size:12px;line-height:1.6;color:#94A3B8;">Need help or want us to review your setup? Reply to this email and the NetTwin team will help.</p>
          <p style="margin:0;font-size:11px;line-height:1.6;color:#64748B;">You are receiving this because you created a digital twin on NetTwin.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const renderTwinReadyText = ({ userName, twinName, liveLink, readySources }) => {
  const sourcesLine = readySources.length ? `Indexed sources: ${readySources.join(", ")}.` : "";
  return `Your AI Digital Twin is Ready

Hi ${userName},

${twinName} is live and ready to represent you. We finished processing your profile knowledge so visitors can ask meaningful questions and get grounded answers from your uploaded sources.

${sourcesLine}

Open Your Twin: ${liveLink}

Need help? Reply to this email and the NetTwin team will help.`;
};

const titleCase = (value) =>
  String(value || "")
    .slice(0, 1)
    .toUpperCase() + String(value || "").slice(1);

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

