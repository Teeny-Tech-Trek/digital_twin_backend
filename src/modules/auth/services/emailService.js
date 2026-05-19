import User from '../../../models/User.js';
import {
  generateVerificationToken,
  hashVerificationToken,
  generatePasswordResetToken,
  hashPasswordResetToken
} from '../utils/tokenUtils.js';

/**
 * Email verification and password reset service
 * Note: Email sending would be integrated here (Sendgrid, AWS SES, etc.)
 */
const emailService = {
  /**
   * Send email verification token
   * (Integration point for email service)
   */
  async sendVerificationEmail(user, token) {
    try {
      // TODO: Integrate with email service (Sendgrid, SES, etc.)
      // Example:
      // const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
      // await emailProvider.send({
      //   to: user.email,
      //   subject: 'Verify your email',
      //   html: `<a href="${verifyLink}">Verify Email</a>`
      // });

      console.log(
        `[EMAIL] Verification token for ${user.email}: ${token}`
      );
      
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  },

  /**
   * Send password reset email
   * (Integration point for email service)
   */
  async sendPasswordResetEmail(user, token) {
    try {
      // TODO: Integrate with email service
      // Example:
      // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      // await emailProvider.send({
      //   to: user.email,
      //   subject: 'Reset your password',
      //   html: `<a href="${resetLink}">Reset Password</a>`
      // });

      console.log(
        `[EMAIL] Password reset token for ${user.email}: ${token}`
      );
      
      return true;
    } catch (error) {
      console.error('Error sending reset email:', error);
      throw error;
    }
  },

  /**
   * Create and send email verification token
   */
  async sendVerificationTokenForUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate token
      const token = generateVerificationToken();
      const tokenHash = hashVerificationToken(token);

      // Store token in user
      user.emailVerificationToken = tokenHash;
      user.emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await user.save();

      // Send email
      await this.sendVerificationEmail(user, token);

      return {
        success: true,
        message: 'Verification email sent'
      };
    } catch (error) {
      console.error('Error sending verification token:', error);
      throw error;
    }
  },

  /**
   * Verify email with token
   */
  async verifyEmailWithToken(userId, token) {
    try {
      const user = await User.findById(userId).select('+emailVerificationToken');
      if (!user) {
        throw new Error('User not found');
      }

      const tokenHash = hashVerificationToken(token);

      // Verify token
      if (user.emailVerificationToken !== tokenHash) {
        throw new Error('Invalid verification token');
      }

      // Check expiry
      if (new Date() > user.emailVerificationTokenExpiry) {
        throw new Error('Verification token expired');
      }

      // Mark email as verified
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationTokenExpiry = undefined;
      await user.save();

      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      console.error('Error verifying email:', error);
      throw error;
    }
  },

  /**
   * Create and send password reset token
   */
  async sendPasswordResetTokenForUser(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new Error('User not found');
      }

      // Generate token
      const token = generatePasswordResetToken();
      const tokenHash = hashPasswordResetToken(token);

      // Store token in user
      user.passwordResetToken = tokenHash;
      user.passwordResetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      // Send email
      await this.sendPasswordResetEmail(user, token);

      return {
        success: true,
        message: 'Password reset email sent'
      };
    } catch (error) {
      console.error('Error sending password reset token:', error);
      throw error;
    }
  },

  /**
   * Reset password with token
   */
  async resetPasswordWithToken(token, newPassword) {
    try {
      const tokenHash = hashPasswordResetToken(token);

      const user = await User.findOne({ passwordResetToken: tokenHash });
      if (!user) {
        throw new Error('Invalid password reset token');
      }

      // Check expiry
      if (new Date() > user.passwordResetTokenExpiry) {
        throw new Error('Password reset token expired');
      }

      // Hash new password
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash(newPassword, 10);

      // Update password and clear reset tokens
      user.password = hashedPassword;
      user.passwordResetToken = undefined;
      user.passwordResetTokenExpiry = undefined;
      user.lastPasswordChangeAt = new Date();
      
      // Revoke all existing refresh tokens (force re-login everywhere)
      user.refreshTokens = [];

      await user.save();

      return {
        success: true,
        message: 'Password reset successfully. Please login again.'
      };
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }
};

export default emailService;
