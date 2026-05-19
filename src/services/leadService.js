// backend/services/leadService.js
import Lead from "../models/Lead.js";
import DigitalTwin from "../models/DigitalTwin.js";

export const createLead = async (twinId, userEmail, message, contactData = {}) => {
  const twin = await DigitalTwin.findById(twinId);
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
  return lead;
};

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
