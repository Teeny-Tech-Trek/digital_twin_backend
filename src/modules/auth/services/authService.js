import User from '../../../models/User.js';
import passwordService from './passwordService.js';
import tokenService from './tokenService.js';
import emailService from './emailService.js';
import googleOAuthService from './googleOAuthService.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from '../utils/tokenUtils.js';

/**
 * Main authentication service
 * Orchestrates all auth flows:
 * - Email/password signup & login
 * - Google OAuth
 * - Password reset & email verification
 * - Session management
 * 
 * ENFORCES: One email = one user (no duplicates)
 */
const authService = {
  /**
   * Signup with email and password
   * 
   * Prevents duplicate signup if user already exists
   */
  async signupWithPassword({ name, email, password }) {
    try {
      // Validate password
      const passwordValidation = passwordService.validatePassword(password);
      if (!passwordValidation.isValid) {
        const error = new Error(passwordValidation.errors[0]);
        error.statusCode = 400;
        throw error;
      }

      // Check if email already exists
      const existingUser = await User.findOne({
        email: email.toLowerCase()
      });

      if (existingUser) {
        const error = new Error(
          'Email already registered. Try logging in or use a different email.'
        );
        error.statusCode = 409; // Conflict
        throw error;
      }

      // Hash password
      const hashedPassword = await passwordService.hash(password);

      // Create user
      const user = await User.create({
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        providers: [
          {
            type: 'email',
            verified: false // Password users must verify email
          }
        ]
      });

      // Send verification email
      try {
        await emailService.sendVerificationTokenForUser(user._id);
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        // Don't fail signup, just log the error
      }

      // Generate tokens (even though email not verified yet)
      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Store refresh token
      await tokenService.storeRefreshToken(
        user._id,
        refreshToken,
        undefined, // IP address if available
        undefined  // User agent if available
      );

      return {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          providers: user.providers,
          profilePicture: user.profilePicture
        },
        accessToken,
        refreshToken,
        isNewUser: true,
        message:
          'Signup successful. Please verify your email to complete onboarding.'
      };
    } catch (error) {
      console.error('Error in signupWithPassword:', error);
      throw error;
    }
  },

  /**
   * Login with email and password
   */
  async loginWithPassword({ email, password }) {
    try {
      // Find user by email
      const user = await User.findOne({
        email: email.toLowerCase()
      }).select('+password');

      if (!user) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      // Check if user has password auth method
      if (!user.password) {
        const error = new Error(
          'This email is registered with Google. Please use Google login or reset your password.'
        );
        error.statusCode = 401;
        throw error;
      }

      // Verify password
      const isValidPassword = await passwordService.verify(password, user.password);
      if (!isValidPassword) {
        // Increment failed login attempts
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

        // Lock account after 5 failed attempts
        if (user.failedLoginAttempts >= 5) {
          user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
          await user.save();

          const error = new Error(
            'Account locked due to multiple failed attempts. Try again later.'
          );
          error.statusCode = 429; // Too Many Requests
          throw error;
        }

        await user.save();

        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      // Check if account is locked
      if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
        const error = new Error(
          'Account is temporarily locked. Try again later.'
        );
        error.statusCode = 429;
        throw error;
      }

      // Reset failed attempts on successful login
      user.failedLoginAttempts = 0;
      user.accountLockedUntil = undefined;
      user.lastLoginAt = new Date();

      // Generate tokens
      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Store refresh token
      await tokenService.storeRefreshToken(
        user._id,
        refreshToken,
        undefined,
        undefined
      );

      await user.save();

      return {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          onboardingCompleted: user.onboardingCompleted,
          providers: user.providers,
          profilePicture: user.profilePicture
        },
        accessToken,
        refreshToken
      };
    } catch (error) {
      console.error('Error in loginWithPassword:', error);
      throw error;
    }
  },

  /**
   * Login or signup with Google OAuth
   * 
   * Verifies Google token server-side
   * Enforces one-email-one-user
   */
  async loginWithGoogle(googleToken, ipAddress, userAgent) {
    try {
      // Verify Google token (CRITICAL: server-side verification)
      const googleData = await googleOAuthService.verifyGoogleToken(googleToken);

      // Find or create user
      const { user, isNewUser, linked } =
        await googleOAuthService.findOrCreateUser(googleData);

      // Update last login
      user.lastLoginAt = new Date();

      // Generate tokens
      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Store refresh token
      await tokenService.storeRefreshToken(
        user._id,
        refreshToken,
        ipAddress,
        userAgent
      );

      await user.save();

      return {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          onboardingCompleted: user.onboardingCompleted,
          providers: user.providers,
          avatar: user.avatar,
          profilePicture: user.profilePicture
        },
        accessToken,
        refreshToken,
        isNewUser,
        linked,
        message: linked
          ? 'Google account linked successfully'
          : isNewUser
          ? 'Welcome! Google signup successful'
          : 'Google login successful'
      };
    } catch (error) {
      console.error('Error in loginWithGoogle:', error);
      throw error;
    }
  },

  /**
   * Refresh access token
   */
  async refreshAccessToken(userId, refreshToken, ipAddress) {
    try {
      // Verify refresh token is valid and not revoked
      await tokenService.verifyRefreshTokenIsValid(userId, refreshToken);

      // Verify JWT
      verifyRefreshToken(refreshToken);

      // Generate new access token
      const newAccessToken = generateAccessToken(userId);

      // Optionally rotate refresh token (create new one, revoke old)
      const newRefreshToken = generateRefreshToken(userId);
      await tokenService.revokeToken(userId, refreshToken);
      await tokenService.storeRefreshToken(
        userId,
        newRefreshToken,
        ipAddress,
        undefined
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      console.error('Error in refreshAccessToken:', error);
      throw error;
    }
  },

  /**
   * Logout user
   * Revokes all refresh tokens
   */
  async logout(userId) {
    try {
      await tokenService.revokeAllTokens(userId);

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Error in logout:', error);
      throw error;
    }
  },

  /**
   * Get current user profile
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
        providers: user.providers,
        avatar: user.avatar,
        profilePicture: user.profilePicture,
        lastLoginAt: user.lastLoginAt
      };
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      throw error;
    }
  },

  /**
   * Update user profile (name, picture, etc.)
   */
  async updateUserProfile(userId, updates) {
    try {
      const allowedFields = ['name', 'profilePicture', 'avatar'];
      const updateData = {};

      for (const field of allowedFields) {
        if (field in updates) {
          updateData[field] = updates[field];
        }
      }

      const user = await User.findByIdAndUpdate(userId, updateData, {
        new: true
      });

      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      return user;
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      throw error;
    }
  },

  /**
   * Change password (when user knows old password)
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      if (!user.password) {
        const error = new Error(
          'This account was registered with Google. Please reset password first.'
        );
        error.statusCode = 400;
        throw error;
      }

      // Verify old password
      const isValid = await passwordService.verify(oldPassword, user.password);
      if (!isValid) {
        const error = new Error('Current password is incorrect');
        error.statusCode = 401;
        throw error;
      }

      // Validate new password
      const validation = passwordService.validatePassword(newPassword);
      if (!validation.isValid) {
        const error = new Error(validation.errors[0]);
        error.statusCode = 400;
        throw error;
      }

      // Hash and save new password
      const hashedPassword = await passwordService.hash(newPassword);
      user.password = hashedPassword;
      user.lastPasswordChangeAt = new Date();

      // Invalidate all other sessions
      user.refreshTokens = [];

      await user.save();

      return {
        success: true,
        message: 'Password changed successfully. Please login again.'
      };
    } catch (error) {
      console.error('Error in changePassword:', error);
      throw error;
    }
  }
};

export default authService;
