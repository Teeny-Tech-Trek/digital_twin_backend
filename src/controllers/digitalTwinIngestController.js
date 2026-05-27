// src/controllers/digitalTwinIngestController.js
//
// Resume + website ingestion proxies. The NetTwin frontend uploads here;
// we forward to the AI backend's /v1/ingest/* routes and return the job
// id so the dashboard can poll for "indexing → ready" status.

import asyncHandler from "../middleware/asyncHandler.js";
import DigitalTwin from "../models/DigitalTwin.js";
import aiEngine from "../services/aiEngineClient.js";
import { maybeSendTwinReadyEmail } from "../services/twinNotificationService.js";
import { ensureDraftDigitalTwin } from "../services/digitalTwinService.js";

const INTERNAL_TOKEN_HEADER = "x-internal-token";

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

const extractInternalToken = (req) =>
  req.headers[INTERNAL_TOKEN_HEADER] ||
  (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

const requireInternalToken = (req) => {
  const expected = (process.env.AI_BACKEND_INTERNAL_TOKEN || "").trim();
  const actual = String(extractInternalToken(req) || "").trim();
  return Boolean(expected) && actual === expected;
};

const tenantIdToTwinId = (tenantId = "") => {
  const normalized = String(tenantId).trim();
  if (!/^twin-[a-f0-9]{24}$/i.test(normalized)) return null;
  return normalized.replace(/^twin-/i, "");
};

/**
 * Upload-first onboarding needs a tenant anchor before the user has completed
 * the full wizard. We create a local draft twin lazily and ensure the AI
 * backend tenant exists, but we deliberately do NOT push placeholder profile
 * text to the AI index.
 */
const resolveOrCreateCallerTwin = async (req, seed = {}) => {
  const twin = await ensureDraftDigitalTwin(req.user._id, seed);
  const ensureResult = await aiEngine.ensureTenant({
    twinId: twin._id,
    displayName: twin.identity?.name || "",
    owner: req.user._id?.toString?.() || "",
  });
  if (!ensureResult.ok) {
    const err = new Error(ensureResult.error?.message || "Could not initialize AI tenant.");
    err.statusCode = 502;
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
  const twin = await resolveOrCreateCallerTwin(req);
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
  const explicitUrl = (req.body?.url || "").trim();
  const existingTwin = await DigitalTwin.findOne({ user: req.user._id });
  const fallbackUrl = (
    existingTwin?.links?.website ||
    existingTwin?.links?.portfolio ||
    ""
  ).trim();
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

  const twin = await resolveOrCreateCallerTwin(req, { website: url });

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
 * POST /api/digital-twin/internal/ingest-complete
 * POST /api/digital-twin/internal/ingestion-complete
 *
 * Internal webhook called by the AI backend when a tenant flips to ready.
 * We verify the shared token, confirm the tenant really is ready, and then
 * trigger the idempotent "your twin is ready" email path server-side.
 */
export const ingestComplete = asyncHandler(async (req, res) => {
  if (!requireInternalToken(req)) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid internal token",
    });
  }

  const tenantId = String(req.body?.tenant_id || "").trim();
  const twinId = tenantIdToTwinId(tenantId);
  if (!tenantId || !twinId) {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: "tenant_id must look like twin-<mongoid>.",
    });
  }

  const twin = await DigitalTwin.findById(twinId).populate("user");
  if (!twin) {
    return res.status(404).json({
      success: false,
      error: "TWIN_NOT_FOUND",
      message: `No digital twin found for tenant ${tenantId}`,
    });
  }

  const statusResult = await aiEngine.getTenantStatus({ twinId: twin._id });
  if (!statusResult.ok) {
    return res.status(statusResult.error?.status || 502).json({
      success: false,
      error: "AI_ENGINE_UNAVAILABLE",
      message: statusResult.error?.message || "Could not reach AI engine.",
      detail: statusResult.error?.body || null,
    });
  }

  const aiStatus = statusResult.data || {};
  if (aiStatus.overall_status !== "ready") {
    return res.status(409).json({
      success: false,
      error: "TENANT_NOT_READY",
      message: `Tenant ${tenantId} is not ready yet.`,
      data: aiStatus,
    });
  }

  let notify;
  try {
    notify = await maybeSendTwinReadyEmail({ twin, aiStatus });
  } catch (err) {
    console.warn(`[ingestComplete] twin-ready notifier threw: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "NOTIFIER_ERROR",
      message: err.message || "Ready notifier failed.",
    });
  }

  return res.json({
    success: true,
    message: "Ingestion completion acknowledged",
    tenantId,
    emailed: Boolean(notify?.emailed),
    notice: notify?.reason || null,
    data: aiStatus,
  });
});

/**
 * GET /api/digital-twin/extracted-profile
 * Return the AI backend's extracted structured profile for the caller's twin.
 * Used by the wizard's upload-first onboarding autofill step.
 */
export const extractedProfile = asyncHandler(async (req, res) => {
  const twin = await resolveCallerTwin(req);
  const result = await aiEngine.getTenantProfile({ twinId: twin._id });
  if (!result.ok) {
    return res.status(result.error?.status || 502).json({
      success: false,
      error: "AI_ENGINE_UNAVAILABLE",
      message: result.error?.message || "Could not reach AI engine.",
    });
  }
  res.json({
    success: true,
    data: result.data,
  });
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
