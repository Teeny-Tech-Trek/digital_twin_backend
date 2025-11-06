// backend/services/leadService.js
import Lead from "../models/Lead.js";
import DigitalTwin from "../models/DigitalTwin.js";

export const createLead = async (twinId, userEmail, message) => {
  const twin = await DigitalTwin.findById(twinId);
  if (!twin) throw new Error("Digital twin not found");

  const lead = new Lead({
    twinId,
    userEmail,
    message,
    source: "chat",
  });

  await lead.save();
  return lead;
};

export const getLeadsByTwin = async (twinId) => {
  const leads = await Lead.find({ twinId }).sort({ createdAt: -1 });
  return leads;
};