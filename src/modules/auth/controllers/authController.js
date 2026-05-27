import asyncHandler from '../../../middleware/asyncHandler.js';
import authService from '../services/authService.js';
import emailService from '../services/emailService.js';

/**
 * Auth controllers
 * Handle HTTP requests and coordinate with auth services
 */

// Centralized refresh-token cookie config.
//
// Why `sameSite: 'lax'` (was 'strict'):
//   Production deploys FE on `nettwin.techtrekkers.ai` and API on
//   `api.nettwin.techtrekkers.ai`. Even though these share the same
//   registrable domain (eTLD+1), 'strict' is treated inconsistently across
//   browsers for top-level navigation that lands on the FE after an external
//   redirect (e.g. Google OAuth popup, email-link return, browser back from
//   external site). 'lax' is the modern-SaaS default — cookie still travels
//   on XHR/fetch (which is all we need for /auth/refresh from the FE) and
//   on top-level GET navigations, but not on cross-site POSTs (CSRF safe).
//
// Why no `domain` attribute:
//   Cookie is set on `api.nettwin...` host and only needs to travel back to
//   that host. Setting `domain: '.techtrekkers.ai'` would leak it to sibling
//   subdomains (ttt-payment-service, etc.) which is exactly what we DON'T
//   want.
const REFRESH_COOKIE_NAME = 'refreshToken';
const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
});

// clearCookie must match the original Set-Cookie's attributes (minus maxAge)
// or browsers silently keep the stale cookie around.
const refreshClearOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/'
});

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

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());

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

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());

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

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());

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
 * Refresh access token using refresh token from cookie.
 *
 * Failure modes are all 401 with a stable error code so the FE axios
 * interceptor can distinguish "session expired, clear state" from a generic
 * 401 on some other endpoint:
 *   - REFRESH_COOKIE_MISSING : no cookie present (probably first load, or
 *                              SameSite blocked it — FE should not treat as
 *                              an active logout).
 *   - REFRESH_TOKEN_INVALID  : cookie present but decode/verify failed (FE
 *                              must clear local session).
 *   - REFRESH_TOKEN_REVOKED  : authService rejected (rotated already, or
 *                              user logged out elsewhere) — same handling.
 *
 * Always clears the cookie on failure so a poisoned cookie doesn't keep
 * triggering 401s on every page load.
 */
export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      code: 'REFRESH_COOKIE_MISSING',
      message: 'Refresh token required'
    });
  }

  // We `decode` (not `verify`) only to read the `sub` claim so authService can
  // look up the stored hash for that user. authService.refreshAccessToken
  // performs the full signature + DB-hash verification — never trust this
  // payload for authorization. If decode fails or sub is missing the token
  // is malformed and we bail.
  const jwt = await import('jsonwebtoken');
  let decoded;
  try {
    decoded = jwt.default.decode(refreshToken);
  } catch {
    decoded = null;
  }

  if (!decoded || !decoded.sub) {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshClearOptions());
    return res.status(401).json({
      success: false,
      code: 'REFRESH_TOKEN_INVALID',
      message: 'Invalid refresh token'
    });
  }

  try {
    const result = await authService.refreshAccessToken(
      decoded.sub,
      refreshToken,
      ipAddress
    );

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());

    return res.json({
      success: true,
      message: 'Token refreshed',
      accessToken: result.accessToken
    });
  } catch (err) {
    // Verification failed (signature, expiry, or hash mismatch in DB).
    // Wipe the poisoned cookie so the next request lands in the
    // REFRESH_COOKIE_MISSING branch instead of looping here.
    res.clearCookie(REFRESH_COOKIE_NAME, refreshClearOptions());
    return res.status(401).json({
      success: false,
      code: 'REFRESH_TOKEN_REVOKED',
      message: err?.message || 'Refresh token revoked'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (requires valid token)
 */
export const logout = asyncHandler(async (req, res) => {
  const userId = req.userId;

  await authService.logout(userId);

  res.clearCookie(REFRESH_COOKIE_NAME, refreshClearOptions());

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

  await emailService.sendPasswordResetTokenForUser(email);

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
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired password reset link'
    });
  }

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
  res.clearCookie(REFRESH_COOKIE_NAME, refreshClearOptions());

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
