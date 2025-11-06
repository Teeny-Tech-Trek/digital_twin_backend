// backend/routes/leadRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getLeads } from "../controllers/leadController.js";

const router = express.Router();

router.get("/:twinId", protect, getLeads);

export default router;