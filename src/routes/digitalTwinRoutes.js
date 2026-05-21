import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getDigitalTwin,
  createUpdateDigitalTwin,
  patchSection,
  deleteTwin,
  getPublicTwin,
} from "../controllers/digitalTwinController.js";

const router = express.Router();

// Single-twin-per-user model. There used to be a /list endpoint for
// multi-twin support and a canCreateTwin quota middleware on /create —
// both were removed when the product decided on strict one-twin-per-user.
//
// /create is an UPSERT keyed on user id, so it doubles as the "save my
// twin" endpoint for both initial creation and full re-edits from the
// wizard. The unique index on `user` in the schema makes duplicate
// creation impossible at the database layer.

router.get("/get", protect, getDigitalTwin);
router.post("/create", protect, createUpdateDigitalTwin);
router.patch("/section", protect, patchSection);
router.delete("/delete", protect, deleteTwin);
router.get("/public/:twinId", getPublicTwin);

export default router;
