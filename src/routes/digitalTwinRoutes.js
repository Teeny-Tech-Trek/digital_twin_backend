import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/authMiddleware.js";
import {
  getDigitalTwin,
  createUpdateDigitalTwin,
  patchSection,
  deleteTwin,
  getPublicTwin,
} from "../controllers/digitalTwinController.js";
import {
  ingestResume,
  ingestWebsite,
  ingestionStatus,
  jobStatus,
  resyncProfile,
  extractedProfile,
  ingestComplete,
} from "../controllers/digitalTwinIngestController.js";

const router = express.Router();
// TEMPORARY: rate limiting disabled for QA/testing when
// DISABLE_RATE_LIMIT=true. MUST be re-enabled before large-scale public
// launch. Mirrors the same flag used by apiLimiter/authLimiter in server.js.
const ingestionPollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "RATE_LIMITED",
    message: "Too many ingestion polling requests. Please slow down and try again.",
  },
  skip: () => process.env.DISABLE_RATE_LIMIT === "true",
});

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

// -----------------------------------------------------------------------------
// AI-backend ingestion proxies
// -----------------------------------------------------------------------------
// File uploads use multer with memoryStorage so we can forward the Buffer
// straight to the AI backend. Capped at 15 MB to match the AI backend's
// internal limit — bounce oversized uploads here so they never traverse
// the proxy.
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post(
  "/ingest/resume",
  protect,
  resumeUpload.single("file"),
  ingestResume
);
router.post("/ingest/website", protect, ingestWebsite);
router.get("/ingestion-status", protect, ingestionPollLimiter, ingestionStatus);
router.get("/jobs/:jobId", protect, ingestionPollLimiter, jobStatus);
router.get("/extracted-profile", protect, extractedProfile);
router.post("/resync", protect, resyncProfile);
router.post("/internal/ingest-complete", ingestComplete);
router.post("/internal/ingestion-complete", ingestComplete);

export default router;
