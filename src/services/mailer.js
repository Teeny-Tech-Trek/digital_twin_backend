// src/services/mailer.js
//
// Email transport for NetTwin.
//
// Real transport when SMTP_* env vars are set (production / staging).
// Console-log fallback otherwise (local dev or before nodemailer is
// installed) — so the rest of the codebase can call `mailer.send(...)`
// unconditionally without branching on environment.
//
// Used by:
//   - sendTwinReadyEmail (digital-twin completion notification)
//   - emailService (verification + password reset — currently stubs that
//     can migrate to this once you're ready)
//
// Required env vars for real send:
//   SMTP_HOST           e.g. smtp.gmail.com / email-smtp.us-east-1.amazonaws.com
//   SMTP_PORT           465 (TLS) or 587 (STARTTLS)
//   SMTP_USER
//   SMTP_PASS
//   MAIL_FROM           "NetTwin <no-reply@nettwin.techtrekkers.ai>"
// Optional:
//   SMTP_SECURE         "true" (default true when port==465)
//   FRONTEND_URL        used in template links (falls back to CLIENT_URL)

let transporter = null;
let transporterTried = false;

const _logSent = (to, subject) => {
  // eslint-disable-next-line no-console
  console.log(`[mailer] sent to=${to} subject=${JSON.stringify(subject)}`);
};

const _logSkipped = (to, subject, reason) => {
  // eslint-disable-next-line no-console
  console.log(
    `[mailer] DRY RUN (no SMTP configured: ${reason}) — would send to=${to} subject=${JSON.stringify(subject)}`
  );
};

const _hasSmtpConfig = () =>
  !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

/**
 * Lazy-initialize the nodemailer transport. We do this lazily so:
 *   - Tests / dev environments don't need nodemailer installed.
 *   - Boot doesn't fail if SMTP env is missing (just degrades to console).
 *   - If nodemailer is missing at runtime we log clearly instead of crashing.
 */
const _getTransporter = async () => {
  if (transporter || transporterTried) return transporter;
  transporterTried = true;

  if (!_hasSmtpConfig()) return null;

  try {
    const nodemailer = await import("nodemailer");
    const port = parseInt(process.env.SMTP_PORT, 10);
    const secure =
      typeof process.env.SMTP_SECURE === "string"
        ? process.env.SMTP_SECURE.toLowerCase() === "true"
        : port === 465;
    transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`[mailer] SMTP transport ready (host=${process.env.SMTP_HOST}, port=${port})`);
    return transporter;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[mailer] nodemailer not installed — falling back to console logging. Run "npm install nodemailer" to enable real email. (${err.message})`
    );
    return null;
  }
};

/**
 * Send an email. Returns `{ sent: boolean, dryRun: boolean }` so callers
 * can decide whether to mark a "notification sent" flag in the DB.
 *
 * Important: throws ONLY for caller mistakes (missing `to` / `subject`).
 * Transport failures are logged and the promise resolves with sent:false
 * so the calling flow (e.g. twin creation) is never broken by a flaky SMTP.
 */
const send = async ({ to, subject, html, text, replyTo }) => {
  if (!to || !subject) {
    throw new Error("mailer.send: `to` and `subject` are required");
  }

  const from =
    process.env.MAIL_FROM ||
    `NetTwin <no-reply@${(process.env.SMTP_HOST || "nettwin.local").replace(/^.*?@/, "")}>`;

  const transport = await _getTransporter();

  if (!transport) {
    _logSkipped(to, subject, _hasSmtpConfig() ? "transport-init-failed" : "missing-SMTP-env");
    return { sent: false, dryRun: true };
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      html,
      text: text || _htmlToText(html),
      replyTo,
    });
    _logSent(to, subject);
    return { sent: true, dryRun: false };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[mailer] send failed (to=${to}): ${err.message}`);
    return { sent: false, dryRun: false };
  }
};

/** Crude HTML -> plain-text fallback for the `text` field. */
const _htmlToText = (html = "") =>
  String(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export default { send };
