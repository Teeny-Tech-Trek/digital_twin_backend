import DigitalTwin from "../models/DigitalTwin.js";

/**
 * Multi-twin service layer.
 *
 * History: this module used to assume one twin per user (the schema had a
 * unique index on `user`). When we added plan-gated multi-twin support
 * (free=1, pro=10) we dropped that index — see migration
 * `scripts/migrations/2026-05-multi-twin.js` and the comment on the model.
 *
 * What changed:
 *   - `createOrUpdateDigitalTwin` is gone. It was an upsert keyed on `user`,
 *     which silently turned every "Create another twin" call into "edit
 *     your existing twin". Now `createDigitalTwin` is a true insert.
 *   - `getDigitalTwinByUser` returns the user's MOST RECENT twin (for
 *     legacy single-twin frontend code that hasn't migrated to listing).
 *   - `listDigitalTwinsByUser` is the new list-all helper. The Dashboard
 *     should migrate to this once the multi-twin UI ships.
 *   - section-level updates and delete now require a `twinId` so we don't
 *     accidentally mutate the wrong twin on multi-twin accounts.
 */

/**
 * Backward-compatible single-twin getter — returns the most-recently-updated
 * twin owned by `userId`, or `null` if they have none.
 *
 * Frontend code that still expects "the user has one twin" calls this.
 * New code should prefer `listDigitalTwinsByUser`.
 */
export const getDigitalTwinByUser = async (userId) => {
  return await DigitalTwin.findOne({ user: userId }).sort({ lastUpdated: -1 });
};

/** Return ALL twins owned by `userId`, newest-updated first. */
export const listDigitalTwinsByUser = async (userId) => {
  return await DigitalTwin.find({ user: userId }).sort({ lastUpdated: -1 });
};

/** Count helper used by plan-gating middleware and the billing-status endpoint. */
export const countDigitalTwinsByUser = async (userId) => {
  return await DigitalTwin.countDocuments({ user: userId });
};

/**
 * Create a new digital twin for `userId`. ALWAYS inserts a new document —
 * no upsert. The caller (route layer) is responsible for plan-gating via
 * canCreateTwin middleware; this function trusts that the quota check has
 * already passed.
 */
export const createDigitalTwin = async (userId, data) => {
  const digitalTwin = new DigitalTwin({
    user: userId,
    ...data,
    lastUpdated: new Date(),
  });
  await digitalTwin.save();
  return digitalTwin;
};

/**
 * Replace an entire twin's contents (everything except `user`).
 * Used by the wizard "edit existing twin" path if the frontend ever
 * exposes it; today the wizard always creates new.
 *
 * Throws if the twin doesn't exist or isn't owned by `userId` (to prevent
 * IDOR — never trust a twinId from the client without ownership check).
 */
export const updateDigitalTwin = async (userId, twinId, data) => {
  const digitalTwin = await DigitalTwin.findOne({ _id: twinId, user: userId });
  if (!digitalTwin) {
    const err = new Error("Digital twin not found");
    err.statusCode = 404;
    throw err;
  }
  Object.assign(digitalTwin, data);
  digitalTwin.lastUpdated = new Date();
  await digitalTwin.save();
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

/**
 * Patch a single section of a single twin.
 *
 * `twinId` is OPTIONAL for backward compatibility: if omitted, the user's
 * most-recent twin is targeted (legacy single-twin behavior). For
 * multi-twin accounts the caller MUST pass a twinId to avoid editing the
 * wrong one — log a warning if we fall back.
 */
export const updateSection = async (userId, section, sectionData, twinId = null) => {
  if (!ALLOWED_SECTIONS.includes(section)) throw new Error("Invalid section");

  const query = twinId ? { _id: twinId, user: userId } : { user: userId };
  const digitalTwin = await DigitalTwin.findOne(query).sort({ lastUpdated: -1 });
  if (!digitalTwin) {
    const err = new Error("Digital twin not found");
    err.statusCode = 404;
    throw err;
  }

  if (!twinId) {
    // Caller passed no twinId. If the user has more than one twin, we just
    // edited their most-recent one. Surface this so we can find legacy
    // callers and migrate them.
    const total = await DigitalTwin.countDocuments({ user: userId });
    if (total > 1) {
      console.warn(
        `[updateSection] no twinId passed but user ${userId} owns ${total} twins — patched the most recent (${digitalTwin._id}). Update caller to pass twinId.`
      );
    }
  }

  digitalTwin[section] = sectionData;
  digitalTwin.lastUpdated = new Date();
  await digitalTwin.save();
  return digitalTwin;
};

/**
 * Delete a twin.
 * If `twinId` is provided, deletes that specific twin (with ownership check).
 * Otherwise deletes the user's most-recent twin (legacy behavior).
 */
export const deleteDigitalTwin = async (userId, twinId = null) => {
  if (twinId) {
    const result = await DigitalTwin.findOneAndDelete({ _id: twinId, user: userId });
    if (!result) {
      const err = new Error("Digital twin not found");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }

  const digitalTwin = await DigitalTwin.findOne({ user: userId }).sort({ lastUpdated: -1 });
  if (!digitalTwin) {
    const err = new Error("Digital twin not found");
    err.statusCode = 404;
    throw err;
  }
  await DigitalTwin.deleteOne({ _id: digitalTwin._id });
  return digitalTwin;
};

export const getPublicDigitalTwin = async (twinId) => {
  return await DigitalTwin.findById(twinId).populate("user", "name email");
};

// Legacy alias — some imports still reference this name. Routes to true
// create. Will be removed once all callers are migrated.
export const createOrUpdateDigitalTwin = createDigitalTwin;
