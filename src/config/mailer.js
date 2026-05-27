// src/config/mailer.js
// Singleton Nodemailer transport. Lazily initialized on first send so the
// app boots even if SMTP env vars are missing (we fall back to a console
// logger in that case — useful for local dev and for unit tests).
//
// Required env vars for real sending:
//   SMTP_HOST     e.g. smtp.gmail.com
//   SMTP_PORT     e.g. 465
//   SMTP_SECURE   "true" for 465, "false" for 587
//   SMTP_USER     gmail address / SMTP login
//   SMTP_PASS     app password (NOT your normal Gmail password)
//   SMTP_FROM     "NetTwin <noreply@yourdomain.com>"
//   MAIL_FROM     Alternative sender env used by newer NetTwin services.

import nodemailer from "nodemailer";

let transporter = null;
let initialized = false;

const buildTransport = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn(
      "[MAILER] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — emails will be logged to the console only."
    );
    return null;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure =
    typeof process.env.SMTP_SECURE === "string"
      ? process.env.SMTP_SECURE.toLowerCase() === "true"
      : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const getTransport = () => {
  if (!initialized) {
    transporter = buildTransport();
    initialized = true;
  }
  return transporter;
};

export const getFromAddress = () =>
  process.env.MAIL_FROM ||
  process.env.SMTP_FROM ||
  (process.env.SMTP_USER ? `NetTwin <${process.env.SMTP_USER}>` : "NetTwin <no-reply@nettwin.local>");

/**
 * Send an email. Resolves regardless of transport availability — when SMTP
 * isn't configured we log the payload and return `{ delivered: false }`, so
 * callers can treat email as best-effort and never break a request flow.
 */
export const sendMail = async ({ to, subject, html, text }) => {
  const transport = getTransport();
  const from = getFromAddress();

  if (!transport) {
    console.log(`[MAILER:STUB] To=${to} Subject="${subject}"`);
    console.log("[MAILER:STUB] Email body suppressed in logs to avoid leaking secure links or tokens.");
    return { delivered: false, stub: true };
  }

  try {
    const info = await transport.sendMail({ from, to, subject, html, text });
    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MAILER] Failed to send "${subject}" to ${to}:`, error.message);
    return { delivered: false, error: error.message };
  }
};

export default { sendMail, getFromAddress };
