import asyncHandler from "../middleware/asyncHandler.js";
import DigitalTwin from "../models/DigitalTwin.js";
import {
  getDigitalTwinByUser,
  listDigitalTwinsByUser,
  createDigitalTwin,
  updateSection,
  deleteDigitalTwin,
  getPublicDigitalTwin,
} from "../services/digitalTwinService.js";


// GET /api/digital-twin/get
// Returns the user's most-recently-updated twin (single object), or 404 if
// they have none. Preserves the legacy single-twin shape the frontend
// Dashboard still consumes — when the frontend migrates to a multi-twin
// listing UI it should call /list instead.
export const getDigitalTwin = asyncHandler(async (req, res) => {
  const twin = await getDigitalTwinByUser(req.user._id);
  if (!twin) {
    return res.status(404).json({ success: false, message: "Digital twin not found" });
  }
  res.json({ success: true, data: twin });
});

// GET /api/digital-twin/list
// Returns ALL twins owned by the user, newest-updated first. Empty array
// (not 404) when the user has none — list endpoints should never 404 on
// "you have nothing yet".
export const listDigitalTwins = asyncHandler(async (req, res) => {
  const twins = await listDigitalTwinsByUser(req.user._id);
  res.json({ success: true, data: twins, count: twins.length });
});

// POST /api/digital-twin/create
// Always inserts a NEW twin. Plan quota is enforced by `canCreateTwin`
// middleware in the route — if the request reaches the controller, the
// quota check has already passed. The controller no longer upserts; that
// silently lost data on multi-twin accounts (every "Create another"
// rewrote the existing one).
export const createUpdateDigitalTwin = asyncHandler(async (req, res) => {
  const { identity } = req.body;
  if (!identity?.name || !identity?.role || !identity?.bio) {
    return res.status(400).json({ success: false, message: "Name, role, and bio are required" });
  }

  const digitalTwin = await createDigitalTwin(req.user._id, req.body);
  res.status(201).json({
    success: true,
    message: "Digital twin created successfully",
    data: digitalTwin,
  });
});

export const patchSection = asyncHandler(async (req, res) => {
  const { section, data } = req.body;
  const digitalTwin = await updateSection(req.user._id, section, data);
  res.json({ success: true, message: `${section} updated successfully`, data: digitalTwin });
});

// DELETE /api/digital-twin/delete       → deletes most-recent twin (legacy).
// DELETE /api/digital-twin/delete/:twinId → deletes a specific twin if owned.
// The service layer enforces ownership; a forged twinId belonging to another
// user returns 404 (no leak that the twin exists).
export const deleteTwin = asyncHandler(async (req, res) => {
  const { twinId } = req.params;
  await deleteDigitalTwin(req.user._id, twinId || null);
  res.json({ success: true, message: "Digital twin deleted successfully" });
});

export const getPublicTwin = asyncHandler(async (req, res) => {
  const { twinId } = req.params;
  console.log("🪞 Requested Twin ID:", twinId);

  const twin = await DigitalTwin.findById(twinId).populate("user", "name email");
  console.log("Found Twin:", twin);

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
