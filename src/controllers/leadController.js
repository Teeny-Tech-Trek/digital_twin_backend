// backend/controllers/leadController.js
import asyncHandler from "express-async-handler";
import * as leadService from "../services/leadService.js";

const ALLOWED_STATUSES = ["new", "contacted", "qualified", "converted", "closed"];

/**
 * POST /api/leads
 * Public — chatbot visitors submit lead capture. Body:
 *   { twinId, name, email|userEmail, phone, company, message, interest }
 * Frontend has historically sent the visitor's email as either `email` or
 * `userEmail`; we accept both so the contract stays loose.
 */
export const createLead = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const { twinId, name, phone, company, interest, message } = body;
  const email = body.email || body.userEmail;

  // The Lead schema requires twinId, userEmail, name, phone, company, message.
  // Validate them all here with an explicit 400 — throwing untyped errors
  // would fall through to a 500.
  const missing = [];
  if (!twinId) missing.push("twinId");
  if (!email) missing.push("email");
  if (!name) missing.push("name");
  if (!phone) missing.push("phone");
  if (!company) missing.push("company");
  if (!message && !interest) missing.push("message");
  if (missing.length) {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: `Missing required fields: ${missing.join(", ")}`,
    });
  }

  try {
    const lead = await leadService.createLead(twinId, email, message || interest, {
      name,
      phone,
      company,
      interest,
    });
    return res.status(201).json({ success: true, data: lead });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "TWIN_NOT_FOUND" : "LEAD_CREATE_FAILED",
      message: error.message || "Failed to create lead",
    });
  }
});

export const getLeads = asyncHandler(async (req, res) => {
  const leads = await leadService.getLeadsByTwin(req.params.twinId);
  res.json({ success: true, data: leads });
});

export const updateLeadStatus = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const { status } = req.body || {};

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }

  try {
    const lead = await leadService.updateLeadStatus(leadId, status);
    return res.json({ success: true, data: lead });
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({
      success: false,
      error: code === 404 ? "LEAD_NOT_FOUND" : "LEAD_UPDATE_FAILED",
      message: error.message || "Failed to update lead",
    });
  }
});
