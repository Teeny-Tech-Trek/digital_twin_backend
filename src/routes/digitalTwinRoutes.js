import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { canCreateTwin } from "../modules/billing/billing.middleware.js";
import {
  getDigitalTwin,
  listDigitalTwins,
  createUpdateDigitalTwin,
  patchSection,
  deleteTwin,
  getPublicTwin,
} from "../controllers/digitalTwinController.js";

const router = express.Router();

// GET /get — legacy single-twin getter (most-recent twin). Kept for
// frontend backward compatibility with the current Dashboard.
router.get("/get", protect, getDigitalTwin);

// GET /list — multi-twin listing. Preferred for new UI code. Returns an
// array (possibly empty) of all twins the user owns.
router.get("/list", protect, listDigitalTwins);

// POST /create — true insert, plan-gated.
// `canCreateTwin` middleware enforces:
//   • free plan: at most 1 twin
//   • pro plan:  at most 10 twins
// Returns 429 QUOTA_EXCEEDED with `{ current, limit, redirectTo }` so the
// frontend can show the upgrade modal AND any direct API caller (curl,
// mobile app) gets the same actionable error shape.
router.post("/create", protect, canCreateTwin, createUpdateDigitalTwin);

router.patch("/section", protect, patchSection);
// Legacy delete (no id) → removes the most-recent twin. Preferred new form
// passes an id so the UI can delete a specific twin from a multi-twin list.
router.delete("/delete", protect, deleteTwin);
router.delete("/delete/:twinId", protect, deleteTwin);
router.get("/public/:twinId", getPublicTwin);

export default router;
