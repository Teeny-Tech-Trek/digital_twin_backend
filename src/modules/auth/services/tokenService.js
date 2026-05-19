import User from '../../../models/User.js';
import {
  hashRefreshToken,
  verifyRefreshToken
} from '../utils/tokenUtils.js';

/**
 * Refresh token lifecycle management
 * Handles:
 * - Storing refresh tokens in DB
 * - Rotating refresh tokens
 * - Revoking tokens
 * - Cleanup of expired tokens
 */
const tokenService = {
  /**
   * Store refresh token in user's token list
   * Hashes the token before storing for security
   */
  async storeRefreshToken(userId, token, ipAddress, userAgent) {
    try {
      const tokenHash = hashRefreshToken(token);
      const decoded = verifyRefreshToken(token);
      
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Add new refresh token
      user.refreshTokens.push({
        tokenHash,
        expiresAt: new Date(decoded.exp * 1000),
        ipAddress,
        userAgent
      });

      // Keep only last 5 refresh tokens (limit stored tokens)
      if (user.refreshTokens.length > 5) {
        user.refreshTokens = user.refreshTokens.slice(-5);
      }

      await user.save();
      return true;
    } catch (error) {
      console.error('Error storing refresh token:', error);
      throw error;
    }
  },

  /**
   * Verify refresh token is valid and not revoked
   */
  async verifyRefreshTokenIsValid(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const tokenHash = hashRefreshToken(token);
      
      // Find token in user's token list
      const storedToken = user.refreshTokens.find(
        rt => rt.tokenHash === tokenHash && !rt.revokedAt
      );

      if (!storedToken) {
        throw new Error('Refresh token not found or revoked');
      }

      // Check expiry
      if (new Date() > storedToken.expiresAt) {
        throw new Error('Refresh token expired');
      }

      return true;
    } catch (error) {
      console.error('Error verifying refresh token:', error);
      throw error;
    }
  },

  /**
   * Revoke all refresh tokens (logout all sessions)
   */
  async revokeAllTokens(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Mark all tokens as revoked
      user.refreshTokens.forEach(token => {
        token.revokedAt = new Date();
      });

      await user.save();
      return true;
    } catch (error) {
      console.error('Error revoking all tokens:', error);
      throw error;
    }
  },

  /**
   * Revoke specific refresh token
   */
  async revokeToken(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const tokenHash = hashRefreshToken(token);
      const foundToken = user.refreshTokens.find(
        rt => rt.tokenHash === tokenHash
      );

      if (foundToken) {
        foundToken.revokedAt = new Date();
        await user.save();
      }

      return true;
    } catch (error) {
      console.error('Error revoking token:', error);
      throw error;
    }
  },

  /**
   * Clean up expired tokens from user
   */
  async cleanupExpiredTokens(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date();
      user.refreshTokens = user.refreshTokens.filter(
        token => token.expiresAt > now && !token.revokedAt
      );

      await user.save();
      return user.refreshTokens.length;
    } catch (error) {
      console.error('Error cleaning up tokens:', error);
      throw error;
    }
  },

  /**
   * Get active refresh token count for user
   */
  async getActiveTokenCount(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date();
      return user.refreshTokens.filter(
        token => token.expiresAt > now && !token.revokedAt
      ).length;
    } catch (error) {
      console.error('Error getting active token count:', error);
      throw error;
    }
  }
};

export default tokenService;
