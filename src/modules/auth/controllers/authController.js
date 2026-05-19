import asyncHandler from '../../../middleware/asyncHandler.js';
import authService from '../services/authService.js';
import emailService from '../services/emailService.js';

/**
 * Auth controllers
 * Handle HTTP requests and coordinate with auth services
 */

/**
 * POST /api/auth/signup
 * Sign up with email and password
 */
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const result = await authService.signupWithPassword({
    name,
    email,
    password
  });

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.status(201).json({
    success: true,
    message: result.message,
    user: result.user,
    accessToken: result.accessToken
  });
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await authService.loginWithPassword({
    email,
    password
  });

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    success: true,
    message: 'Logged in successfully',
    user: result.user,
    accessToken: result.accessToken
  });
});

/**
 * POST /api/auth/google
 * Login/signup with Google OAuth
 * 
 * Frontend sends Google ID token, we verify it server-side
 */
export const googleAuth = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const result = await authService.loginWithGoogle(
    token,
    ipAddress,
    userAgent
  );

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    success: true,
    message: result.message,
    user: result.user,
    accessToken: result.accessToken,
    isNewUser: result.isNewUser,
    linked: result.linked
  });
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token from cookie
 */
export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token required'
    });
  }

  // Extract userId from token (without full verification)
  // Full verification happens in authService
  const jwt = await import('jsonwebtoken');
  const decoded = jwt.default.decode(refreshToken);

  if (!decoded || !decoded.sub) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }

  const result = await authService.refreshAccessToken(
    decoded.sub,
    refreshToken,
    ipAddress
  );

  // Set new refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    success: true,
    message: 'Token refreshed',
    accessToken: result.accessToken
  });
});

/**
 * POST /api/auth/logout
 * Logout user (requires valid token)
 */
export const logout = asyncHandler(async (req, res) => {
  const userId = req.userId;

  await authService.logout(userId);

  // Clear refresh token cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * POST /api/auth/forgot-password
 * Request password reset token
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const result = await emailService.sendPasswordResetTokenForUser(email);

  // For security, always return success (don't leak if email exists)
  res.json({
    success: true,
    message:
      'If an account exists with that email, a reset link has been sent'
  });
});

/**
 * POST /api/auth/reset-password/:token
 * Reset password with token
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const result = await emailService.resetPasswordWithToken(token, password);

  res.json({
    success: true,
    message: result.message
  });
});

/**
 * POST /api/auth/verify-email/:token
 * Verify email with token
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const userId = req.userId;

  const result = await emailService.verifyEmailWithToken(userId, token);

  res.json({
    success: true,
    message: result.message
  });
});

/**
 * POST /api/auth/resend-verification
 * Resend email verification token
 */
export const resendVerification = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const result = await emailService.sendVerificationTokenForUser(userId);

  res.json({
    success: true,
    message: result.message
  });
});

/**
 * GET /api/auth/profile
 * Get current user profile
 */
export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const user = await authService.getUserProfile(userId);

  res.json({
    success: true,
    user
  });
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const updates = req.body;

  const user = await authService.updateUserProfile(userId, updates);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      avatar: user.avatar
    }
  });
});

/**
 * POST /api/auth/change-password
 * Change password (requires old password)
 */
export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { oldPassword, newPassword } = req.body;

  const result = await authService.changePassword(
    userId,
    oldPassword,
    newPassword
  );

  // Clear all refresh tokens (force re-login everywhere)
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.json({
    success: true,
    message: result.message
  });
});

export default {
  signup,
  login,
  googleAuth,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  getProfile,
  updateProfile,
  changePassword
};
