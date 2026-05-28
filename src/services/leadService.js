// backend/services/leadService.js
import Lead from "../models/Lead.js";
import DigitalTwin from "../models/DigitalTwin.js";
import mailer from "./mailer.js";

export const createLead = async (twinId, userEmail, message, contactData = {}) => {
  // Populate the owner so we can email them when a new lead lands. The owner
  // is the User who created the twin; that's where the notification goes.
  const twin = await DigitalTwin.findById(twinId).populate("user", "name email");
  if (!twin) {
    const error = new Error("Digital twin not found");
    error.statusCode = 404;
    throw error;
  }

  const lead = new Lead({
    twinId,
    userEmail,
    name: contactData.name || "Anonymous User",
    phone: contactData.phone || "",
    company: contactData.company || "N/A",
    message,
    interest: contactData.interest || message,
  });

  await lead.save();
  console.log(
    `[LEAD] New lead for ${twin.identity?.name || twinId}: ${lead.name} from ${lead.company}`
  );

  // Fire-and-forget owner notification. Lead capture must never fail because
  // SMTP is flaky — the lead is already persisted by the time we get here.
  notifyOwnerOfNewLead({ twin, lead }).catch((err) =>
    console.warn(`[LEAD] owner notification failed for twin=${twinId}: ${err.message}`),
  );

  return lead;
};

const notifyOwnerOfNewLead = async ({ twin, lead }) => {
  const ownerEmail = twin.user?.email;
  if (!ownerEmail) return; // nothing to do — twin has no resolvable owner email

  const twinName = twin.identity?.name || "your digital twin";
  const submittedAt = (lead.createdAt || new Date()).toISOString();
  const subject = `New connect request from ${lead.name} via ${twinName}`;

  await mailer.send({
    to: ownerEmail,
    subject,
    html: renderNewLeadHtml({ twinName, lead, submittedAt }),
    text: renderNewLeadText({ twinName, lead, submittedAt }),
    // Reply goes straight to the visitor so the owner can respond inline.
    replyTo: lead.userEmail || undefined,
  });
};

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderNewLeadHtml = ({ twinName, lead, submittedAt }) => {
  const row = (label, value) => `
    <tr>
      <td style="padding:8px 0;color:#94A3B8;font-size:12px;width:120px;vertical-align:top;">${esc(label)}</td>
      <td style="padding:8px 0;color:#E2E8F0;font-size:14px;">${esc(value || "—")}</td>
    </tr>`;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#05050f;font-family:Inter,Arial,Helvetica,sans-serif;color:#E2E8F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05050f;padding:28px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(135deg,#0b1120 0%,#111837 100%);border:1px solid rgba(34,211,238,0.28);border-radius:20px;overflow:hidden;">
      <tr><td style="padding:26px 26px 6px 26px;">
        <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(34,211,238,0.10);border:1px solid rgba(34,211,238,0.24);color:#67E8F9;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">New Lead</div>
        <h1 style="margin:14px 0 6px 0;font-size:22px;color:#fff;font-weight:800;">${esc(lead.name)} wants to connect</h1>
        <p style="margin:0 0 18px 0;font-size:13px;color:#94A3B8;">Submitted via ${esc(twinName)} · ${esc(submittedAt)}</p>
      </td></tr>
      <tr><td style="padding:0 26px 22px 26px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.16);border-radius:14px;">
          <tr><td style="padding:12px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${row("Name", lead.name)}
              ${row("Email", lead.userEmail)}
              ${row("Phone", lead.phone)}
              ${row("Company", lead.company)}
              ${row("Interest", lead.interest || lead.message)}
            </table>
          </td></tr>
        </table>
        <p style="margin:18px 0 0 0;font-size:12px;color:#64748B;">Reply to this email to respond directly to ${esc(lead.name)}.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
};

const renderNewLeadText = ({ twinName, lead, submittedAt }) =>
  `New connect request via ${twinName}
Submitted: ${submittedAt}

Name:     ${lead.name}
Email:    ${lead.userEmail}
Phone:    ${lead.phone || "—"}
Company:  ${lead.company || "—"}
Interest: ${lead.interest || lead.message || "—"}

Reply to this email to respond directly to ${lead.name}.`;

export const getLeadsByTwin = async (twinId) => {
  return await Lead.find({ twinId }).sort({ createdAt: -1 }).populate("twinId", "identity.name");
};

export const updateLeadStatus = async (leadId, newStatus) => {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    const error = new Error("Lead not found");
    error.statusCode = 404;
    throw error;
  }
  lead.status = newStatus;
  await lead.save();
  return lead;
};
