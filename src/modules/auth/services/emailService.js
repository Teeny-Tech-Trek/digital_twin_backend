import User from '../../../models/User.js';
import { sendMail } from '../../../config/mailer.js';
import {
  generateVerificationToken,
  hashVerificationToken,
  generatePasswordResetToken,
  hashPasswordResetToken
} from '../utils/tokenUtils.js';

const clientUrl = () =>
  (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.NETTWIN_FRONTEND_URL ||
    'http://localhost:8080'
  ).replace(/\/$/, '');

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

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const brandedEmail = ({ eyebrow = 'NetTwin', title, body, ctaLabel, ctaUrl, footer }) => `
  <!doctype html>
  <html>
  <body style="margin:0;padding:0;background:#05050f;font-family:Inter,Arial,Helvetica,sans-serif;color:#e2e8f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05050f;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:linear-gradient(135deg,#0b1120 0%,#111837 52%,#1e1b4b 100%);border:1px solid rgba(139,92,246,0.34);border-radius:24px;overflow:hidden;">
          <tr><td style="padding:34px 30px 18px 30px;">
            <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(34,211,238,0.10);border:1px solid rgba(34,211,238,0.24);color:#67e8f9;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:18px 0 12px 0;font-size:28px;line-height:1.2;color:#fff;font-weight:800;">${escapeHtml(title)}</h1>
            <div style="font-size:15px;line-height:1.7;color:#cbd5e1;">${body}</div>
            <div style="margin:26px 0 8px 0;">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 24px;border-radius:14px;background:linear-gradient(90deg,#22d3ee 0%,#3b82f6 52%,#a855f7 100%);color:#fff;text-decoration:none;font-weight:800;font-size:15px;">${escapeHtml(ctaLabel)}</a>
            </div>
          </td></tr>
          <tr><td style="padding:18px 30px 26px 30px;border-top:1px solid rgba(139,92,246,0.22);">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">${footer}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

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
      const html = brandedEmail({
        title: 'Confirm your NetTwin email',
        body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(user.name || 'there')}, confirm your email to keep your NetTwin account secure. This link expires in 24 hours.</p>`,
        ctaLabel: 'Verify Email',
        ctaUrl: link,
        footer: "If you did not create a NetTwin account, you can ignore this email.",
      });
      const text = `Verify your NetTwin email: ${link}`;
      const result = await sendMail({
        to: user.email,
        subject: 'Verify your NetTwin email',
        html,
        text,
      });
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
      const html = brandedEmail({
        title: 'Reset your NetTwin password',
        body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(user.name || 'there')}, use the secure button below to create a new password. This recovery link expires in 1 hour.</p><p style="margin:0;color:#94a3b8;">If you did not request this, no action is needed.</p>`,
        ctaLabel: 'Reset Password',
        ctaUrl: link,
        footer: "For your security, this link can only be used once and expires automatically.",
      });
      const text = `Reset your NetTwin password: ${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`;
      const result = await sendMail({
        to: user.email,
        subject: 'Reset your NetTwin password',
        html,
        text,
      });
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
        return {
          success: true,
          message: 'If an account exists with that email, a reset link has been sent'
        };
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
        const error = new Error('Invalid or expired password reset link');
        error.statusCode = 400;
        throw error;
      }

      // Check expiry
      if (new Date() > user.passwordResetTokenExpiry) {
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpiry = undefined;
        await user.save();
        const error = new Error('Invalid or expired password reset link');
        error.statusCode = 400;
        throw error;
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
