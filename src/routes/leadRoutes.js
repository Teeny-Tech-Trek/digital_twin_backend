// backend/routes/leadRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getLeads,createLead,updateLeadStatus} from "../controllers/leadController.js";

const router = express.Router();

router.post("/", createLead);
router.get("/:twinId", protect, getLeads);


router.patch("/:leadId/status", protect, updateLeadStatus);


export default router;