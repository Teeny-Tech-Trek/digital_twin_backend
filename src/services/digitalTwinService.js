import DigitalTwin from "../models/DigitalTwin.js";

export const getDigitalTwinByUser = async (userId) => {
  return await DigitalTwin.findOne({ user: userId });
};

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

export const updateSection = async (userId, section, sectionData) => {
  const allowedSections = [
    "identity", "businesses", "experience", "education", 
    "skills", "personality", "story", "networking", "links",
  ];

  if (!allowedSections.includes(section)) throw new Error("Invalid section");

  const digitalTwin = await DigitalTwin.findOne({ user: userId });
  if (!digitalTwin) throw new Error("Digital twin not found");

  digitalTwin[section] = sectionData;
  digitalTwin.lastUpdated = new Date();
  await digitalTwin.save();

  return digitalTwin;
};

export const deleteDigitalTwin = async (userId) => {
  const digitalTwin = await DigitalTwin.findOne({ user: userId });
  if (!digitalTwin) throw new Error("Digital twin not found");
  await DigitalTwin.deleteOne({ user: userId });
};

export const getPublicDigitalTwin = async (twinId) => {
  return await DigitalTwin.findById(twinId).populate("user", "name email");
};