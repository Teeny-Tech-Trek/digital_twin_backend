import asyncHandler from "../middleware/asyncHandler.js";
import DigitalTwin from "../models/DigitalTwin.js";
import {
  getDigitalTwinByUser,
  createOrUpdateDigitalTwin,
  updateSection,
  deleteDigitalTwin,
  getPublicDigitalTwin,
} from "../services/digitalTwinService.js";


export const getDigitalTwin = asyncHandler(async (req, res) => {
  const twin = await getDigitalTwinByUser(req.user._id);
  if (!twin) {
    return res.status(404).json({ success: false, message: "Digital twin not found" });
  }
  res.json({ success: true, data: twin });
});

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
