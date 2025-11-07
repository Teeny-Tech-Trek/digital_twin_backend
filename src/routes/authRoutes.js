// routes/authRoutes.js
import express from "express";
import passport from "passport";
import {
  registerUser,
  loginUser,
  googleAuth,
} from "../controllers/authController.js";
import { updateProfilePicture, getProfile, updateProfile, upload, getPublicProfile } from "../controllers/profileController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Manual Auth
router.post("/signup", registerUser);
router.post("/login", loginUser);

// Google OAuth (REST)
router.post("/google", googleAuth);

// Profile routes
router.get("/profile", protect, getProfile);
router.get("/public/:agentId", getPublicProfile);
router.put("/profile", protect, updateProfile);
router.put("/profile/picture", protect, upload.single('profilePicture'), updateProfilePicture);

// Google OAuth (redirect flow)
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  }
);

export default router;