import express from 'express';
import * as authController from '../controllers/authController.js';
import * as authMiddleware from '../middleware/authMiddleware.js';
import {
  validateRequest,
  signupSchema,
  loginSchema,
  googleLoginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  updateProfileSchema
} from '../validators/authValidators.js';

const router = express.Router();

/**
 * Public Auth Routes
 * No authentication required
 */

// Signup with email/password
router.post(
  '/signup',
  validateRequest(signupSchema),
  authController.signup
);

// Login with email/password
router.post(
  '/login',
  validateRequest(loginSchema),
  authController.login
);

// Login with Google OAuth
// Frontend sends Google ID token
router.post(
  '/google',
  validateRequest(googleLoginSchema),
  authController.googleAuth
);

// Refresh access token
// Uses refresh token from httpOnly cookie
router.post(
  '/refresh',
  validateRequest(refreshTokenSchema),
  authController.refresh
);

// Forgot password (password reset request)
router.post(
  '/forgot-password',
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);

// Reset password with token
router.post(
  '/reset-password/:token',
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

/**
 * Protected Auth Routes
 * Requires valid access token
 */

// Logout
router.post(
  '/logout',
  authMiddleware.protect,
  authController.logout
);

// Verify email with token
router.post(
  '/verify-email/:token',
  authMiddleware.protect,
  authController.verifyEmail
);

// Resend email verification
router.post(
  '/resend-verification',
  authMiddleware.protect,
  authController.resendVerification
);

// Get current user profile
router.get(
  '/profile',
  authMiddleware.protect,
  authController.getProfile
);

// Update user profile
router.put(
  '/profile',
  authMiddleware.protect,
  validateRequest(updateProfileSchema),
  authController.updateProfile
);

// Change password
router.post(
  '/change-password',
  authMiddleware.protect,
  validateRequest(changePasswordSchema),
  authController.changePassword
);

export default router;
