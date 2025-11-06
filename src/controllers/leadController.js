// backend/controllers/leadController.js
import asyncHandler from "express-async-handler";
import * as leadService from "../services/leadService.js";

export const getLeads = asyncHandler(async (req, res) => {
  const leads = await leadService.getLeadsByTwin(req.params.twinId);
  res.json({ success: true, data: leads });
});