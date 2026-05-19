import { OAuth2Client } from 'google-auth-library';
import User from '../../../models/User.js';

/**
 * Google OAuth provider service
 * Handles:
 * - Google token verification
 * - User creation/linking
 * - Provider metadata handling
 */
class GoogleOAuthService {
  constructor() {
    this.client = new OAuth2Client({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    });
  }

  /**
   * Verify Google ID token (JWT)
   * CRITICAL: Always verify server-side, never trust client
   */
  async verifyGoogleToken(token) {
    try {
      if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error('GOOGLE_CLIENT_ID not configured');
      }

      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();

      return {
        sub: payload.sub,              // Google's unique user ID
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name,
        picture: payload.picture,
        locale: payload.locale,
        hd: payload.hd                 // Google Workspace domain (if applicable)
      };
    } catch (error) {
      console.error('Google token verification failed:', error);

      // Surface the most common misconfiguration explicitly so callers see
      // a 401 with an actionable message instead of a generic 500.
      const isAudienceMismatch = /audience/i.test(error.message || '');
      const verificationError = new Error(
        isAudienceMismatch
          ? 'Google client ID mismatch: the frontend VITE_GOOGLE_CLIENT_ID does not match the backend GOOGLE_CLIENT_ID. Both must be the same OAuth Web client.'
          : `Invalid Google token: ${error.message}`
      );
      verificationError.statusCode = 401;
      verificationError.code = isAudienceMismatch
        ? 'GOOGLE_AUDIENCE_MISMATCH'
        : 'GOOGLE_TOKEN_INVALID';
      throw verificationError;
    }
  }

  /**
   * Find or create user for Google OAuth
   * 
   * Enforces ONE EMAIL = ONE USER
   * 
   * Cases:
   * 1. Email doesn't exist → Create new user
   * 2. Email exists, no Google provider → Link Google provider
   * 3. Email exists with Google provider → Return user (idempotent)
   */
  async findOrCreateUser(googleData) {
    try {
      const { sub, email, email_verified, name, picture } = googleData;

      // CRITICAL: Search by email to enforce one-email-one-user
      let user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // User exists - check if Google provider already linked
        const googleProvider = user.providers.find(p => p.type === 'google');

        if (googleProvider) {
          // Google already linked - update metadata
          googleProvider.metadata = {
            email,
            name,
            picture,
            locale: googleData.locale,
            connectedAt: new Date()
          };
        } else {
          // Link Google to existing email user
          user.providers.push({
            type: 'google',
            sub,
            verified: email_verified,
            metadata: {
              email,
              name,
              picture,
              locale: googleData.locale,
              connectedAt: new Date()
            }
          });
        }

        // Update profile picture if not already set
        if (!user.avatar && picture) {
          user.avatar = picture;
        }

        // Update name if not set or old
        if (!user.name || user.name === 'User') {
          user.name = name;
        }

        await user.save();

        return {
          user,
          isNewUser: false,
          linked: !googleProvider
        };
      }

      // User doesn't exist - create new
      user = await User.create({
        name,
        email: email.toLowerCase(),
        avatar: picture,
        emailVerified: email_verified,
        providers: [
          {
            type: 'google',
            sub,
            verified: email_verified,
            metadata: {
              email,
              name,
              picture,
              locale: googleData.locale,
              connectedAt: new Date()
            }
          }
        ]
      });

      return {
        user,
        isNewUser: true,
        linked: false
      };
    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      throw error;
    }
  }

  /**
   * Check if email has Google provider
   */
  async hasGoogleProvider(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return false;
      }

      return user.providers.some(p => p.type === 'google');
    } catch (error) {
      console.error('Error checking Google provider:', error);
      throw error;
    }
  }

  /**
   * Get Google provider info for user
   */
  async getGoogleProviderInfo(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return null;
      }

      return user.providers.find(p => p.type === 'google') || null;
    } catch (error) {
      console.error('Error getting Google provider info:', error);
      throw error;
    }
  }

  /**
   * Unlink Google provider from user
   * Cannot unlink if user has no password
   */
  async unlinkGoogle(userId) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new Error('User not found');
      }

      // Don't allow unlinking Google if user has no password
      if (!user.password) {
        throw new Error(
          'Cannot unlink Google: Please set a password first'
        );
      }

      // Remove Google provider
      user.providers = user.providers.filter(p => p.type !== 'google');

      await user.save();

      return {
        success: true,
        message: 'Google disconnected'
      };
    } catch (error) {
      console.error('Error unlinking Google:', error);
      throw error;
    }
  }

  /**
   * Update Google profile metadata
   */
  async updateGoogleMetadata(userId, googleData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const googleProvider = user.providers.find(p => p.type === 'google');
      if (!googleProvider) {
        throw new Error('Google provider not linked');
      }

      googleProvider.metadata = {
        ...googleProvider.metadata,
        ...googleData.metadata,
        connectedAt: googleProvider.metadata.connectedAt
      };

      await user.save();

      return user;
    } catch (error) {
      console.error('Error updating Google metadata:', error);
      throw error;
    }
  }
}

export default new GoogleOAuthService();
