import DigitalTwin from "../models/DigitalTwin.js";

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
 */

export const getDigitalTwinByUser = async (userId) => {
  return await DigitalTwin.findOne({ user: userId });
};

/**
 * Create or update the user's single twin.
 * Returns the persisted document (with server-assigned _id, timestamps).
 */
export const createOrUpdateDigitalTwin = async (userId, data) => {
  let digitalTwin = await DigitalTwin.findOne({ user: userId });

  if (digitalTwin) {
    Object.assign(digitalTwin, data);
    digitalTwin.lastUpdated = new Date();
  } else {
    digitalTwin = new DigitalTwin({ user: userId, ...data });
  }

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

export const updateSection = async (userId, section, sectionData) => {
  if (!ALLOWED_SECTIONS.includes(section)) throw new Error("Invalid section");

  const digitalTwin = await DigitalTwin.findOne({ user: userId });
  if (!digitalTwin) {
    const err = new Error("Digital twin not found");
    err.statusCode = 404;
    throw err;
  }

  digitalTwin[section] = sectionData;
  digitalTwin.lastUpdated = new Date();
  await digitalTwin.save();
  return digitalTwin;
};

export const deleteDigitalTwin = async (userId) => {
  const digitalTwin = await DigitalTwin.findOne({ user: userId });
  if (!digitalTwin) {
    const err = new Error("Digital twin not found");
    err.statusCode = 404;
    throw err;
  }
  await DigitalTwin.deleteOne({ user: userId });
  return digitalTwin;
};

export const getPublicDigitalTwin = async (twinId) => {
  return await DigitalTwin.findById(twinId).populate("user", "name email");
};
