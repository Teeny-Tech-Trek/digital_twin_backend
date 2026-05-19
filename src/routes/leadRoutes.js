// backend/routes/leadRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { canCreateLead } from "../modules/billing/billing.middleware.js";
import { getLeads, createLead, updateLeadStatus } from "../controllers/leadController.js";

const router = express.Router();

// Lead capture is public (chatbot visitors submit it). Quota is metered
// against the twin owner via the twinId in the request body.
router.post("/", canCreateLead, createLead);
router.get("/:twinId", protect, getLeads);
router.patch("/:leadId/status", protect, updateLeadStatus);

export default router;
