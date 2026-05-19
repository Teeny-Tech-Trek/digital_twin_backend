import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Generate JWT Access Token (short-lived, 15 minutes)
 * Stored only in memory on frontend (not localStorage)
 */
export const generateAccessToken = (userId) => {
  return jwt.sign(
    { 
      sub: userId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

/**
 * Generate JWT Refresh Token (long-lived, 7 days)
 * Stored in httpOnly cookie, hashed in database
 */
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    {
      sub: userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Hash refresh token for secure storage
 */
export const hashRefreshToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
    );
  } catch (error) {
    throw new Error(`Invalid or expired access token: ${error.message}`);
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error(`Invalid or expired refresh token: ${error.message}`);
  }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

/**
 * Generate secure email verification token
 */
export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash verification token for storage
 */
export const hashVerificationToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

/**
 * Generate secure password reset token
 */
export const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash password reset token for storage
 */
export const hashPasswordResetToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

export default {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  generateVerificationToken,
  hashVerificationToken,
  generatePasswordResetToken,
  hashPasswordResetToken
};
