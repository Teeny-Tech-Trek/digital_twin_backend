// controllers/profileController.js
import asyncHandler from "../middleware/asyncHandler.js";
import DigitalTwin from "../models/DigitalTwin.js";
import User from "../models/User.js";
import * as authService from "../services/authService.js";
import multer from "multer";
import path from "path";

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profile-pictures/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + req.user._id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

export const updateProfilePicture = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const profilePictureUrl = `/uploads/profile-pictures/${req.file.filename}`;
  const user = await authService.updateProfilePicture(req.user._id, profilePictureUrl);
  
  res.json({
    message: "Profile picture updated successfully",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture
    }
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getUserProfile(req.user._id);
  res.json(user);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name },
    { new: true }
  ).select('-password');
  
  res.json({
    message: "Profile updated successfully",
    user
  });
});

export const getPublicProfile = asyncHandler(async (req, res) => {
  const { agentId } = req.params;

  // 1️⃣ Find the agent by ID
  const agent = await DigitalTwin.findById(agentId);
  if (!agent) {
    res.status(404);
    throw new Error("Agent not found");
  }

  // 2️⃣ Find the user who owns this agent
  const user = await User.findById(agent.user).select(
    "_id name email profilePicture avatar"
  );
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // 3️⃣ Optionally, hide email if you want to protect privacy
  const publicProfile = {
    _id: user._id,
    name: user.name,
    profilePicture: user.profilePicture,
    avatar: user.avatar,
  };

  res.status(200).json({
    success: true,
    data: publicProfile,
  });
});