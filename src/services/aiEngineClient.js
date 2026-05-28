// src/services/aiEngineClient.js
//
// Thin client for the AI backend (portfolio-chatbot-backend). All NetTwin
// integrations with the hybrid-RAG engine flow through this module so we
// have ONE place to swap in mocks, change auth, or move to a different
// engine.
//
// What this module does:
//   * Maps a Mongo DigitalTwin._id to an AI-backend tenant_id (`twin-<hex>`).
//   * Maps a Mongoose DigitalTwin document to the structured profile shape
//     the AI engine ingester expects (see `_profile_to_chunks` in
//     portfolio_chatbots/worker/handlers.py).
//   * Calls /v1/* endpoints with the X-Internal-Token shared secret.
//   * Wraps every call in try/catch and surfaces a structured error so
//     NetTwin can decide whether to fail loud or fall back.
//
// What this module deliberately does NOT do:
//   * Persist anything to Mongo. Callers persist; this is a pure proxy.
//   * Generate twin-side prompts. The AI backend owns prompting / retrieval.
//   * Throw on AI engine outages. Twin save / delete should not break just
//     because the AI engine is briefly down — the client returns
//     `{ ok: false, error }` and lets the caller decide.

import axios from "axios";
import FormData from "form-data";

const TIMEOUT_MS = 30_000;          // 30s default — ingestion calls are queued, so the API itself is fast
const CHAT_TIMEOUT_MS = 60_000;     // 60s — RAG + LLM round-trip can be slower

const baseURL = () =>
  (process.env.AI_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

const internalToken = () => process.env.AI_BACKEND_INTERNAL_TOKEN || "";

const internalHeaders = () => {
  const token = internalToken();
  return token ? { "X-Internal-Token": token } : {};
};

/**
 * Build a tenant_id slug from a DigitalTwin Mongo `_id`.
 * Format: "twin-<24-hex>" — fits the AI backend's tenant slug regex
 * `^[a-z0-9][a-z0-9_-]{0,63}$` and is stable across NetTwin restarts.
 */
export const twinIdToTenantId = (twinId) => {
  if (!twinId) throw new Error("twinId is required to derive tenant_id");
  const hex = String(twinId).toLowerCase();
  return `twin-${hex}`;
};

/**
 * Translate a Mongoose DigitalTwin document into the AI backend's
 * "structured profile" payload. We keep the shape close to what the AI
 * engine already handles explicitly, plus pass through the network/links
 * data so QR visitors can ask about LinkedIn/portfolio URLs.
 */
export const twinDocToProfile = (twin) => {
  if (!twin) return {};
  const t = typeof twin.toObject === "function" ? twin.toObject() : twin;

  const identity = {
    name: t.identity?.name || "",
    role: t.identity?.role || "",
    tagline: t.identity?.tagline || "",
    bio: t.identity?.bio || "",
  };

  const skills = Array.isArray(t.skills?.list) ? t.skills.list.filter(Boolean) : [];
  const skillsDetail = {
    coreDomains: t.skills?.coreDomains || "",
    signatureStrengths: t.skills?.signatureStrengths || "",
  };

  return {
    identity,
    bio: identity.bio,
    story: {
      mission: t.story?.mission || "",
      impact: t.story?.impact || "",
      themes: t.story?.themes || [],
    },
    mission: t.story?.mission || "",
    skills: {
      list: skills,
      coreDomains: skillsDetail.coreDomains,
      signatureStrengths: skillsDetail.signatureStrengths,
    },
    skills_detail: skillsDetail,
    businesses: (t.businesses || []).map((b) => ({
      name: b.name,
      title: b.name,
      role: b.role,
      description: b.description,
      link: b.link || "",
      duration: b.duration || "",
      products: b.products || [],
    })),
    experience: (t.experience || []).map((e) => ({
      title: `${e.role} at ${e.company}`,
      name: `${e.role} at ${e.company}`,
      company: e.company,
      role: e.role,
      duration: e.duration,
      summary: (e.key_projects || []).join("; "),
      key_projects: e.key_projects || [],
    })),
    education: (t.education || []).map((e) => ({
      title: `${e.degree} — ${e.institution}`,
      institution: e.institution,
      degree: e.degree,
      year: e.year,
    })),
    personality: {
      traits: t.personality?.traits || [],
      leadership_style: t.personality?.leadership_style || "",
      decision_style: t.personality?.decision_style || "",
      tone: t.personality?.tone || "",
      archetype: t.personality?.archetype || "",
      values: t.personality?.values || [],
    },
    networking: {
      audience: t.networking?.audience || "",
      intent: t.networking?.intent || "",
      boundaries: t.networking?.boundaries || [],
    },
    links: {
      linkedin: t.links?.linkedin || "",
      website: t.links?.website || "",
      portfolio: t.links?.portfolio || "",
      socials: t.links?.socials || [],
    },
    themes: t.story?.themes || [],
    impact: t.story?.impact || "",
  };
};

/**
 * Idempotent — returns the existing tenant or creates a new one.
 * NetTwin calls this once per twin save; the AI backend's registry is a
 * no-op on repeat creates.
 */
export const ensureTenant = async ({ twinId, displayName = "", owner = "" }) => {
  const tenantId = twinIdToTenantId(twinId);
  try {
    const res = await axios.post(
      `${baseURL()}/v1/tenants`,
      { tenant_id: tenantId, display_name: displayName, owner, kind: "twin" },
      { headers: internalHeaders(), timeout: TIMEOUT_MS }
    );
    return { ok: true, tenantId, data: res.data };
  } catch (error) {
    return _wrapError(error, "ensureTenant", tenantId);
  }
};

/**
 * Push the structured profile to the AI backend. Returns a job_id; the
 * AI worker re-embeds and rebuilds the FAISS index for this tenant.
 */
export const pushProfile = async ({ twinId, twin }) => {
  const tenantId = twinIdToTenantId(twinId);
  const profile = twinDocToProfile(twin);
  try {
    const res = await axios.put(
      `${baseURL()}/v1/tenants/${tenantId}/profile`,
      { profile },
      { headers: internalHeaders(), timeout: TIMEOUT_MS }
    );
    return { ok: true, tenantId, jobId: res.data?.job_id, data: res.data };
  } catch (error) {
    return _wrapError(error, "pushProfile", tenantId);
  }
};

/**
 * Upload a resume file (Buffer) to the AI backend.
 *
 * `fileBuffer` is a Node Buffer (e.g. from multer memory storage), and
 * `filename` controls the extension (.pdf / .docx / etc.) the AI ingester
 * uses to pick its extractor.
 */
export const ingestResume = async ({ twinId, fileBuffer, filename, mimetype = "application/octet-stream" }) => {
  const tenantId = twinIdToTenantId(twinId);
  try {
    const form = new FormData();
    form.append("file", fileBuffer, { filename, contentType: mimetype });
    const res = await axios.post(
      `${baseURL()}/v1/tenants/${tenantId}/ingest/resume`,
      form,
      {
        headers: { ...form.getHeaders(), ...internalHeaders() },
        timeout: TIMEOUT_MS,
        maxBodyLength: 25 * 1024 * 1024, // 25 MB
        maxContentLength: 25 * 1024 * 1024,
      }
    );
    return { ok: true, tenantId, jobId: res.data?.job_id, data: res.data };
  } catch (error) {
    return _wrapError(error, "ingestResume", tenantId);
  }
};

/**
 * Kick off a website crawl + ingest for this tenant.
 */
export const ingestWebsite = async ({ twinId, url, maxPages = 30, maxDepth = 2 }) => {
  const tenantId = twinIdToTenantId(twinId);
  try {
    const res = await axios.post(
      `${baseURL()}/v1/tenants/${tenantId}/ingest/website`,
      { url, max_pages: maxPages, max_depth: maxDepth },
      { headers: internalHeaders(), timeout: TIMEOUT_MS }
    );
    return { ok: true, tenantId, jobId: res.data?.job_id, data: res.data };
  } catch (error) {
    return _wrapError(error, "ingestWebsite", tenantId);
  }
};

export const getTenantStatus = async ({ twinId }) => {
  const tenantId = twinIdToTenantId(twinId);
  try {
    const res = await axios.get(
      `${baseURL()}/v1/tenants/${tenantId}/status`,
      { headers: internalHeaders(), timeout: TIMEOUT_MS }
    );
    return { ok: true, tenantId, data: res.data };
  } catch (error) {
    return _wrapError(error, "getTenantStatus", tenantId);
  }
};

export const getTenantProfile = async ({ twinId }) => {
  const tenantId = twinIdToTenantId(twinId);
  try {
    const res = await axios.get(
      `${baseURL()}/v1/tenants/${tenantId}/profile`,
      { headers: internalHeaders(), timeout: TIMEOUT_MS }
    );
    return { ok: true, tenantId, data: res.data };
  } catch (error) {
    return _wrapError(error, "getTenantProfile", tenantId);
  }
};

export const getJob = async ({ jobId }) => {
  try {
    const res = await axios.get(
      `${baseURL()}/v1/jobs/${jobId}`,
      { headers: internalHeaders(), timeout: TIMEOUT_MS }
    );
    return { ok: true, data: res.data };
  } catch (error) {
    return _wrapError(error, "getJob", jobId);
  }
};

export const deleteTenant = async ({ twinId }) => {
  const tenantId = twinIdToTenantId(twinId);
  try {
    const res = await axios.delete(
      `${baseURL()}/v1/tenants/${tenantId}`,
      { headers: internalHeaders(), timeout: TIMEOUT_MS }
    );
    return { ok: true, tenantId, data: res.data };
  } catch (error) {
    return _wrapError(error, "deleteTenant", tenantId);
  }
};

/**
 * Send a chat turn to the AI backend's hybrid-RAG twin chat route.
 *
 * The AI backend expects a single `query` string, so we collapse the
 * `messages` array (NetTwin's current chat contract) into the last user
 * message — the AI engine maintains its own session/coreference state via
 * `session_id`. If you ever want full multi-turn replay (rather than the
 * AI engine's internal memory), you can extend this to bundle the history
 * into the query, but for now session_id-based memory is enough.
 */
export const chat = async ({ twinId, messages, sessionId, userId = "anonymous", userEmail }) => {
  const tenantId = twinIdToTenantId(twinId);
  const lastUserMessage =
    (Array.isArray(messages) && [...messages].reverse().find((m) => m?.role === "user")) ||
    (Array.isArray(messages) && messages[messages.length - 1]) ||
    null;
  const query = lastUserMessage?.content?.trim() || "";
  if (!query) {
    return { ok: false, error: { code: "EMPTY_QUERY", message: "No user message to send." } };
  }

  // session_id is required by the AI engine's request schema. If the caller
  // didn't pass one we fall back to a per-request id, but loudly warn —
  // that means upstream (Node controller or frontend) lost the visitor's
  // persistent id and we just broke conversation memory continuity.
  if (!sessionId) {
    console.warn(
      `[aiEngineClient] chat called without sessionId for twin=${twinId} — falling back to per-request id. ` +
        `Check that the frontend includes sessionId in the chat body and that the Node controller forwards it.`
    );
  }
  try {
    const res = await axios.post(
      // Path-style twin chat — easier to grep in AI-backend logs than the
      // body-style /v1/chat alternative.
      `${baseURL()}/v1/twins/${tenantId}/chat`,
      {
        session_id: sessionId || `nettwin-${twinId}-${Date.now()}`,
        user_id: userId || userEmail || "anonymous",
        query,
      },
      {
        // The twin chat route is public on the AI backend (visitor traffic
        // gets here via NetTwin proxy), so we don't NEED the internal
        // token, but sending it is harmless and useful if we later gate
        // it. Same headers as ingestion calls keeps audit consistent.
        headers: internalHeaders(),
        timeout: CHAT_TIMEOUT_MS,
      }
    );
    const data = res.data || {};
    return {
      ok: true,
      tenantId,
      reply: data.answer || "",
      citations: data.citations || [],
      sessionId: data.session_id || sessionId,
      turnId: data.turn_id,
      latencyMs: data.latency_ms,
      raw: data,
    };
  } catch (error) {
    return _wrapError(error, "chat", tenantId);
  }
};

/**
 * Convenience for the wizard / dashboard: ensure tenant exists AND push
 * the latest profile in one shot. Returns the profile job_id so callers
 * can surface "indexing..." status to the user if they want.
 */
export const syncTwin = async ({ twinId, twin }) => {
  const displayName = twin?.identity?.name || "";
  const owner = twin?.user?.toString?.() || "";
  const ensureResult = await ensureTenant({ twinId, displayName, owner });
  if (!ensureResult.ok) return ensureResult;
  const pushResult = await pushProfile({ twinId, twin });
  return pushResult;
};

// ---------------------------------------------------------------- internals
const _wrapError = (error, op, ctx) => {
  const status = error?.response?.status;
  const body = error?.response?.data;
  const message = error?.message || "AI engine error";
  // eslint-disable-next-line no-console
  console.warn(
    `[aiEngineClient] ${op} failed (ctx=${ctx}, status=${status || "n/a"}): ${message}`
  );
  return {
    ok: false,
    error: {
      op,
      ctx,
      status: status || null,
      message,
      body: body || null,
    },
  };
};

export default {
  twinIdToTenantId,
  twinDocToProfile,
  ensureTenant,
  pushProfile,
  ingestResume,
  ingestWebsite,
  getTenantStatus,
  getTenantProfile,
  getJob,
  deleteTenant,
  chat,
  syncTwin,
};
