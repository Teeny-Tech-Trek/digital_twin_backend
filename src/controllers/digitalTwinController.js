import asyncHandler from "../middleware/asyncHandler.js";
import DigitalTwin from "../models/DigitalTwin.js";
import {
  getDigitalTwinByUser,
  createOrUpdateDigitalTwin,
  updateSection,
  deleteDigitalTwin,
  getPublicDigitalTwin,
} from "../services/digitalTwinService.js";

/**
 * GET /api/digital-twin/get
 * Return the user's single twin, or 404 if none exists yet.
 */
export const getDigitalTwin = asyncHandler(async (req, res) => {
  const twin = await getDigitalTwinByUser(req.user._id);
  if (!twin) {
    return res.status(404).json({ success: false, message: "Digital twin not found" });
  }
  res.json({ success: true, data: twin });
});

/**
 * POST /api/digital-twin/create
 *
 * Single-twin-per-user upsert. First call inserts, subsequent calls
 * update the same document — this matches the wizard's behavior
 * (the wizard pre-fills from the existing twin if any, so the user
 * intent on "Save" is always "create-or-update my one twin").
 *
 * NOTE: this used to be plan-gated by canCreateTwin middleware to
 * enforce free=1 / pro=10 limits. The product decision is now strictly
 * "one twin per user, all plans" — the middleware was removed from
 * the route and the entire plan-gating module was deleted client-side.
 * The unique index on `user` is the ultimate guard.
 */
export const createUpdateDigitalTwin = asyncHandler(async (req, res) => {
  const { identity } = req.body;
  if (!identity?.name || !identity?.role || !identity?.bio) {
    return res.status(400).json({ success: false, message: "Name, role, and bio are required" });
  }

  const digitalTwin = await createOrUpdateDigitalTwin(req.user._id, req.body);
  res.status(200).json({
    success: true,
    message: "Digital twin saved successfully",
    data: digitalTwin,
  });
});

export const patchSection = asyncHandler(async (req, res) => {
  const { section, data } = req.body;
  const digitalTwin = await updateSection(req.user._id, section, data);
  res.json({ success: true, message: `${section} updated successfully`, data: digitalTwin });
});

export const deleteTwin = asyncHandler(async (req, res) => {
  await deleteDigitalTwin(req.user._id);
  res.json({ success: true, message: "Digital twin deleted successfully" });
});

export const getPublicTwin = asyncHandler(async (req, res) => {
  const { twinId } = req.params;

  const twin = await DigitalTwin.findById(twinId).populate("user", "name email");

  if (!twin) {
    return res.status(404).json({
      success: false,
      message: "Digital twin not found",
    });
  }

  res.json({
    success: true,
    data: twin,
  });
});
