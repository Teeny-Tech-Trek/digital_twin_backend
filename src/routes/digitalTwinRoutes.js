import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { canCreateTwin } from "../modules/billing/billing.middleware.js";
import {
  getDigitalTwin,
  createUpdateDigitalTwin,
  patchSection,
  deleteTwin,
  getPublicTwin,
} from "../controllers/digitalTwinController.js";

const router = express.Router();

router.get("/get", protect, getDigitalTwin);
// canCreateTwin gates only first-time creation; the underlying controller
// upserts, so updates to an existing twin won't hit the quota check (count
// stays at 1, limit is >= 1 on every plan).
router.post("/create", protect, canCreateTwin, createUpdateDigitalTwin);
router.patch("/section", protect, patchSection);
router.delete("/delete", protect, deleteTwin);
router.get("/public/:twinId", getPublicTwin);

export default router;
