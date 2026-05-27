import User from '../../../models/User.js';
import { sendMail } from '../../../config/mailer.js';
import {
  generateVerificationToken,
  hashVerificationToken,
  generatePasswordResetToken,
  hashPasswordResetToken
} from '../utils/tokenUtils.js';

const clientUrl = () =>
  process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:8080';

const formatDate = (date) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

/**
 * Email service for NetTwin. Verification, password reset, and billing
 * notifications all funnel through the same Nodemailer transport configured
 * in src/config/mailer.js. When SMTP env vars are missing the transport
 * falls back to console logging — so dev still surfaces the content but
 * nothing actually leaves the box.
 */
const emailService = {
  /** Send the email-verification link to a freshly-registered user. */
  async sendVerificationEmail(user, token) {
    try {
      const link = `${clientUrl()}/verify-email?token=${encodeURIComponent(token)}`;
      const html = `
        <div style="font-family:Inter,system-ui,sans-serif;color:#0f172a;max-width:560px;margin:0 auto">
          <h2>Confirm your NetTwin email</h2>
          <p>Hi ${user.name || 'there'}, please confirm your email by clicking the button below. This link expires in 24 hours.</p>
          <p>
            <a href="${link}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Verify email</a>
          </p>
          <p style="color:#64748b;font-size:13px">If the button doesn't work, paste this link into your browser:<br/>${link}</p>
        </div>`;
      const text = `Verify your NetTwin email: ${link}`;
      const result = await sendMail({
        to: user.email,
        subject: 'Verify your NetTwin email',
        html,
        text,
      });
      if (!result.delivered) {
        console.log(`[EMAIL] (fallback) verification token for ${user.email}: ${token}`);
      }
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  },

  /** Send a password-reset link. */
  async sendPasswordResetEmail(user, token) {
    try {
      const link = `${clientUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      const html = `
        <div style="font-family:Inter,system-ui,sans-serif;color:#0f172a;max-width:560px;margin:0 auto">
          <h2>Reset your NetTwin password</h2>
          <p>Hi ${user.name || 'there'}, click the button below to set a new password. This link expires in 1 hour.</p>
          <p>
            <a href="${link}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a>
          </p>
          <p style="color:#64748b;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        </div>`;
      const text = `Reset your NetTwin password: ${link}`;
      const result = await sendMail({
        to: user.email,
        subject: 'Reset your NetTwin password',
        html,
        text,
      });
      if (!result.delivered) {
        console.log(`[EMAIL] (fallback) password reset token for ${user.email}: ${token}`);
      }
      return true;
    } catch (error) {
      console.error('Error sending reset email:', error);
      throw error;
    }
  },

  /**
   * Notify the twin OWNER (not the chat visitor) that their monthly
   * chat-message quota is exhausted. Called once per billing period by the
   * canSendChatMessage middleware. Best-effort — never throws.
   */
  async sendLimitReachedEmail(user, { used, limit, planName, periodEnd } = {}) {
    try {
      const upgradeUrl = `${clientUrl()}/billing`;
      const renewsOn = formatDate(periodEnd);
      const html = `
        <div style="font-family:Inter,system-ui,sans-serif;color:#0f172a;max-width:560px;margin:0 auto">
          <h2>Your NetTwin digital twin has paused</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>Your <strong>${planName || 'current'}</strong> plan includes
            <strong>${limit}</strong> chat messages per month, and visitors to your
            digital twin have just reached that limit
            (${used} / ${limit} used).</p>
          <p>Until you upgrade${renewsOn ? ` or your quota renews on ${renewsOn}` : ''},
            your twin will show a "currently not available" message to anyone
            who tries to chat with it — including QR-code visitors.</p>
          <p>
            <a href="${upgradeUrl}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Upgrade my plan</a>
          </p>
          <p style="color:#64748b;font-size:13px">Or paste this link into your browser: ${upgradeUrl}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#64748b;font-size:12px">You're receiving this because you own a digital twin on NetTwin.</p>
        </div>`;
      const text = `Your NetTwin digital twin has paused. ${used} / ${limit} chat messages used this period. Upgrade: ${upgradeUrl}`;
      await sendMail({
        to: user.email,
        subject: 'Your NetTwin digital twin has paused — chat limit reached',
        html,
        text,
      });
      return true;
    } catch (error) {
      console.error('Error sending limit-reached email:', error.message);
      return false;
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
