// src/controllers/digitalTwinIngestController.js
//
// Resume + website ingestion proxies. The NetTwin frontend uploads here;
// we forward to the AI backend's /v1/ingest/* routes and return the job
// id so the dashboard can poll for "indexing → ready" status.

import asyncHandler from "../middleware/asyncHandler.js";
import DigitalTwin from "../models/DigitalTwin.js";
import aiEngine from "../services/aiEngineClient.js";
import { maybeSendTwinReadyEmail } from "../services/twinNotificationService.js";

/** Resolve the caller's twin (creates one would be a wizard concern, not here). */
const resolveCallerTwin = async (req) => {
  const twin = await DigitalTwin.findOne({ user: req.user._id });
  if (!twin) {
    const err = new Error(
      "You must create your digital twin first before uploading sources."
    );
    err.statusCode = 404;
    throw err;
  }
  return twin;
};

/**
 * POST /api/digital-twin/ingest/resume
 * multipart/form-data with a single `file` field (PDF / DOCX / TXT).
 *
 * Requires `multer({ storage: multer.memoryStorage() })` in the route.
 * Returns `{ jobId }` — frontend polls /ingestion-status until ready.
 */
export const ingestResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, error: "VALIDATION_ERROR", message: "Missing `file` field." });
  }
  const twin = await resolveCallerTwin(req);
  const result = await aiEngine.ingestResume({
    twinId: twin._id,
    fileBuffer: req.file.buffer,
    filename: req.file.originalname || "resume.pdf",
    mimetype: req.file.mimetype,
  });
  if (!result.ok) {
    return res.status(502).json({
      success: false,
      error: "AI_ENGINE_UNAVAILABLE",
      message: result.error?.message || "Could not reach AI engine.",
    });
  }
  res.status(202).json({
    success: true,
    message: "Resume queued for ingestion",
    jobId: result.jobId,
    tenantId: result.tenantId,
  });
});

/**
 * POST /api/digital-twin/ingest/website
 * JSON: { url, maxPages?, maxDepth? }
 *
 * If the wizard already saved the twin's `links.website`, the frontend
 * can also call this without `url` and we'll fall back to the twin doc.
 */
export const ingestWebsite = asyncHandler(async (req, res) => {
  const twin = await resolveCallerTwin(req);
  const explicitUrl = (req.body?.url || "").trim();
  const fallbackUrl = (twin.links?.website || twin.links?.portfolio || "").trim();
  const rawUrl = explicitUrl || fallbackUrl;
  if (!rawUrl) {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: "url is required (or set links.website on your twin first).",
    });
  }

  // Normalize the URL before forwarding. The AI backend uses pydantic's
  // HttpUrl which rejects bare hosts like "alice.dev" — paper over that
  // here so users don't have to remember the protocol.
  //
  // We accept only http(s). Other schemes (ftp://, mailto:, javascript:)
  // either don't make sense to crawl or are dangerous.
  let url = rawUrl;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url);
  if (!hasScheme) {
    url = `https://${url}`;
  } else if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: `URL scheme not allowed. Use http or https. Got: "${rawUrl}"`,
    });
  }
  try {
    // Final sanity check: must parse as URL with a usable host, and the
    // host must look like a real domain (at least one dot, no spaces).
    const parsed = new URL(url);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      throw new Error("invalid hostname");
    }
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: `Could not parse "${rawUrl}" as a URL.`,
    });
  }

  const result = await aiEngine.ingestWebsite({
    twinId: twin._id,
    url,
    maxPages: Number(req.body?.maxPages) || 30,
    maxDepth: Number(req.body?.maxDepth) || 2,
  });
  if (!result.ok) {
    return res.status(502).json({
      success: false,
      error: "AI_ENGINE_UNAVAILABLE",
      message: result.error?.message || "Could not reach AI engine.",
    });
  }
  res.status(202).json({
    success: true,
    message: "Website queued for ingestion",
    jobId: result.jobId,
    tenantId: result.tenantId,
    url,
  });
});

/**
 * GET /api/digital-twin/ingestion-status
 * Returns the AI engine's status block for the caller's twin.
 *
 * Side effect (idempotent): if this poll observes the twin transitioning
 * to ready AND we haven't already emailed the user, send the "your twin
 * is ready" notification and stamp aiReadyEmailSentAt. The email send is
 * fire-and-forget — a transient SMTP failure does NOT break the status
 * response (the next poll will retry).
 */
export const ingestionStatus = asyncHandler(async (req, res) => {
  const twin = await resolveCallerTwin(req);
  const result = await aiEngine.getTenantStatus({ twinId: twin._id });
  if (!result.ok) {
    return res.status(502).json({
      success: false,
      error: "AI_ENGINE_UNAVAILABLE",
      message: result.error?.message || "Could not reach AI engine.",
    });
  }

  // Best-effort welcome email. Wrapped in try so a notifier blowup never
  // turns a successful status read into a 500.
  let emailNotice = null;
  try {
    const notify = await maybeSendTwinReadyEmail({ twin, aiStatus: result.data });
    if (notify.emailed) emailNotice = "sent";
    else if (notify.reason === "already-sent") emailNotice = "previously-sent";
    else if (notify.reason === "dry-run") emailNotice = "dry-run";
  } catch (err) {
    console.warn(`[ingestionStatus] twin-ready notifier threw: ${err.message}`);
  }

  res.json({
    success: true,
    data: result.data,
    // Frontend uses this to decide whether to flash a "we just emailed
    // you" toast on the transition poll. Optional — absent for already-
    // sent / not-yet-ready states.
    notice: emailNotice,
  });
});

/**
 * GET /api/digital-twin/jobs/:jobId
 * Proxy a single AI-backend job-status lookup. Use this to drive the
 * "Indexing your resume… 60%" progress UI.
 */
export const jobStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  if (!jobId) {
    return res
      .status(400)
      .json({ success: false, error: "VALIDATION_ERROR", message: "Missing jobId." });
  }
  const result = await aiEngine.getJob({ jobId });
  if (!result.ok) {
    return res.status(502).json({
      success: false,
      error: "AI_ENGINE_UNAVAILABLE",
      message: result.error?.message || "Could not reach AI engine.",
    });
  }
  res.json({ success: true, data: result.data });
});

/**
 * POST /api/digital-twin/resync
 * Force-replay the structured profile to the AI engine. Useful when
 * the AI backend was down during a save, or after restoring from backup.
 */
export const resyncProfile = asyncHandler(async (req, res) => {
  const twin = await resolveCallerTwin(req);
  const result = await aiEngine.syncTwin({ twinId: twin._id, twin });
  if (!result.ok) {
    return res.status(502).json({
      success: false,
      error: "AI_ENGINE_UNAVAILABLE",
      message: result.error?.message || "Could not reach AI engine.",
    });
  }
  res.status(202).json({
    success: true,
    message: "Profile re-sync queued",
    jobId: result.jobId,
    tenantId: result.tenantId,
  });
});
