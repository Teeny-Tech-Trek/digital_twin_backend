// backend/controllers/leadController.js
import asyncHandler from "express-async-handler";
import * as leadService from "../services/leadService.js";

export const createLead = asyncHandler(async (req, res) => {
  const { twinId, name, email, phone, company, interest, message } = req.body;
  if (!twinId || !name || !phone || !company) {
    throw new Error("Missing required lead fields");
  }

  const lead = await leadService.createLead(twinId, email, message || interest, {
    name,
    phone,
    company,
    interest,
  });

  res.json({ success: true, data: lead });
});

export const getLeads = asyncHandler(async (req, res) => {
  const leads = await leadService.getLeadsByTwin(req.params.twinId);
  res.json({ success: true, data: leads });
});

export const updateLeadStatus = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const { status } = req.body;

  if (!["new", "contacted", "qualified", "converted"].includes(status)) {
    res.status(400);
    throw new Error("Invalid status value");
  }

  const lead = await leadService.updateLeadStatus(leadId, status);
  res.json({ success: true, data: lead });
});
