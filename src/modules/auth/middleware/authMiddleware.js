import User from '../../../models/User.js';
import { extractTokenFromHeader, verifyAccessToken } from '../utils/tokenUtils.js';

/**
 * Protect middleware
 * Validates access token and attaches user to request
 * 
 * Token must be in Authorization header: "Bearer <token>"
 */
export const protect = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Missing authentication token'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      // Token expired or invalid
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Load user (cache would be good here in production)
    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is disabled'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    console.error('Error in protect middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Optional auth middleware
 * Attaches user if valid token present, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        const user = await User.findById(decoded.sub);
        if (user && user.isActive) {
          req.user = user;
          req.userId = user._id;
        }
      } catch (error) {
        // Token invalid but optional, just continue
      }
    }

    next();
  } catch (error) {
    console.error('Error in optionalAuth middleware:', error);
    next(); // Continue anyway
  }
};

/**
 * Require email verified
 * Use after protect() middleware
 */
export const requireEmailVerified = (req, res, next) => {
  if (!req.user || !req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required to access this resource'
    });
  }
  next();
};

/**
 * Require onboarding completed
 * Use after protect() middleware
 */
export const requireOnboardingCompleted = (req, res, next) => {
  if (!req.user || !req.user.onboardingCompleted) {
    return res.status(403).json({
      success: false,
      message: 'Profile setup required to access this resource'
    });
  }
  next();
};

/**
 * Attach user ID to request from token refresh body
 * Used in refresh endpoint where we might not have the token in headers yet
 */
export const extractUserIdFromRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // We can't fully verify without the secret, but we can decode to get userId
    // The actual verification happens in the service
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.decode(refreshToken);

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    req.userId = decoded.sub;
    next();
  } catch (error) {
    console.error('Error in extractUserIdFromRefreshToken:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

export default {
  protect,
  optionalAuth,
  requireEmailVerified,
  requireOnboardingCompleted,
  extractUserIdFromRefreshToken
};
