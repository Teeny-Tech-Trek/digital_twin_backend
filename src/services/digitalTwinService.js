import DigitalTwin from "../models/DigitalTwin.js";
import aiEngine from "./aiEngineClient.js";
import { sanitizeDigitalTwinPayload } from "../utils/digitalTwinPayload.js";

/**
 * Single-twin-per-user service layer.
 *
 * Each user owns AT MOST one DigitalTwin document, enforced by the unique
 * index on `user` in the schema. POST /api/digital-twin/create is an
 * UPSERT keyed on user id — first call creates, subsequent calls update
 * the same document. This is the canonical write path for the wizard
 * (both initial creation and full re-edits go through it).
 *
 * `updateSection` is a granular patch for editing one slice of the twin
 * (e.g. just `experience`) without re-sending the whole payload — used
 * by inline edit affordances on the dashboard.
 *
 * AI-engine sync:
 *   Every twin write (create/update/section-patch/delete) is mirrored to
 *   the AI backend (portfolio-chatbot-backend) via the aiEngineClient.
 *   Mongo is the source of truth; the AI engine is the retrieval index.
 *   If the AI engine is unreachable, the Mongo write STILL SUCCEEDS — we
 *   log the failure and let the operator re-sync via /resync. This keeps
 *   the wizard's UX resilient to transient AI-backend outages.
 */

export const getDigitalTwinByUser = async (userId) => {
  return await DigitalTwin.findOne({ user: userId });
};

/**
 * Ensure the caller has a placeholder twin record that can anchor upload-first
 * onboarding. This draft exists only so we have a stable Mongo `_id` to map to
 * the AI backend's tenant id before the user finishes the wizard.
 *
 * Important: unlike the normal create/update path, draft creation does NOT
 * sync to the AI engine. Upload-first onboarding should bootstrap the tenant
 * and extracted profile from the sources themselves, not from placeholder text.
 */
export const ensureDraftDigitalTwin = async (userId, seed = {}) => {
  let digitalTwin = await DigitalTwin.findOne({ user: userId });

  if (digitalTwin) {
    let touched = false;
    if (seed.website && !digitalTwin.links?.website) {
      digitalTwin.links = { ...(digitalTwin.links?.toObject?.() || digitalTwin.links || {}), website: seed.website };
      touched = true;
    }
    if (seed.portfolio && !digitalTwin.links?.portfolio) {
      digitalTwin.links = { ...(digitalTwin.links?.toObject?.() || digitalTwin.links || {}), portfolio: seed.portfolio };
      touched = true;
    }
    if (touched) {
      digitalTwin.lastUpdated = new Date();
      await digitalTwin.save();
    }
    return digitalTwin;
  }

  digitalTwin = new DigitalTwin({
    user: userId,
    identity: {
      name: "Draft Twin",
      role: "Draft",
      tagline: "",
      bio: "This twin is being created from uploaded sources. Review and complete the form before publishing.",
    },
    businesses: [],
    experience: [],
    education: [],
    skills: {
      list: [],
      coreDomains: "",
      signatureStrengths: "",
    },
    personality: {
      traits: [],
      leadership_style: "",
      decision_style: "",
      tone: "",
      archetype: "",
      values: [],
    },
    story: {
      mission: "",
      impact: "",
      themes: [],
    },
    networking: {
      audience: "",
      intent: "",
      boundaries: [],
    },
    links: {
      linkedin: "",
      website: seed.website || "",
      portfolio: seed.portfolio || "",
      socials: [],
    },
  });

  await digitalTwin.save();
  return digitalTwin;
};

/**
 * Create or update the user's single twin.
 * Returns the persisted document (with server-assigned _id, timestamps).
 *
 * Side effect: pushes the structured profile to the AI engine so the
 * chatbot reflects the new data on the next message. Best-effort —
 * a failed AI sync is logged but does not block the response.
 */
export const createOrUpdateDigitalTwin = async (userId, data) => {
  const sanitizedData = sanitizeDigitalTwinPayload(data);
  let digitalTwin = await DigitalTwin.findOne({ user: userId });

  if (digitalTwin) {
    Object.assign(digitalTwin, sanitizedData);
    digitalTwin.lastUpdated = new Date();
  } else {
    digitalTwin = new DigitalTwin({ user: userId, ...sanitizedData });
  }

  await digitalTwin.save();

  // Mirror to the AI engine. Fire-and-forget pattern: we await so the
  // wizard's response includes the sync result, but a failure is non-fatal.
  const aiResult = await aiEngine.syncTwin({ twinId: digitalTwin._id, twin: digitalTwin });
  if (!aiResult.ok) {
    console.warn(
      `[twin] AI engine sync failed for twin=${digitalTwin._id}:`,
      aiResult.error?.message
    );
  }

  return digitalTwin;
};

const ALLOWED_SECTIONS = [
  "identity",
  "businesses",
  "experience",
  "education",
  "skills",
  "personality",
  "story",
  "networking",
  "links",
];

export const updateSection = async (userId, section, sectionData) => {
  if (!ALLOWED_SECTIONS.includes(section)) throw new Error("Invalid section");

  const digitalTwin = await DigitalTwin.findOne({ user: userId });
  if (!digitalTwin) {
    const err = new Error("Digital twin not found");
    err.statusCode = 404;
    throw err;
  }

  const sanitizedSection = sanitizeDigitalTwinPayload({ [section]: sectionData })[section];
  digitalTwin[section] = sanitizedSection;
  digitalTwin.lastUpdated = new Date();
  await digitalTwin.save();

  // Re-push the entire profile — the AI engine treats profile pushes as
  // a full replacement (it deletes stale `profile-*` chunks before
  // re-embedding), so a section edit is just another full sync.
  const aiResult = await aiEngine.syncTwin({ twinId: digitalTwin._id, twin: digitalTwin });
  if (!aiResult.ok) {
    console.warn(
      `[twin] AI engine sync failed for section=${section} twin=${digitalTwin._id}:`,
      aiResult.error?.message
    );
  }

  return digitalTwin;
};

export const deleteDigitalTwin = async (userId) => {
  const digitalTwin = await DigitalTwin.findOne({ user: userId });
  if (!digitalTwin) {
    const err = new Error("Digital twin not found");
    err.statusCode = 404;
    throw err;
  }
  const twinId = digitalTwin._id;
  await DigitalTwin.deleteOne({ user: userId });

  // Tear down the AI tenant (FAISS files, Neo4j nodes, profile.json).
  // Mongo delete already succeeded; AI engine failure here just leaves
  // orphaned tenant data that an admin sweeper can clean later.
  const aiResult = await aiEngine.deleteTenant({ twinId });
  if (!aiResult.ok) {
    console.warn(
      `[twin] AI engine tenant delete failed for twin=${twinId}:`,
      aiResult.error?.message
    );
  }

  return digitalTwin;
};

export const getPublicDigitalTwin = async (twinId) => {
  return await DigitalTwin.findById(twinId).populate("user", "name email");
};

/**
 * Force a re-sync of an existing twin to the AI engine. Useful when the
 * AI backend was down during a save, or after restoring AI-backend data
 * from backup. Returns the AI engine's response (incl. job_id).
 */
export const resyncDigitalTwin = async (userId) => {
  const digitalTwin = await DigitalTwin.findOne({ user: userId });
  if (!digitalTwin) {
    const err = new Error("Digital twin not found");
    err.statusCode = 404;
    throw err;
  }
  return aiEngine.syncTwin({ twinId: digitalTwin._id, twin: digitalTwin });
};
