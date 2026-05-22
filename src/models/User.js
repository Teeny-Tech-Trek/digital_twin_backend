import mongoose from 'mongoose';

/**
 * Enhanced User Schema with:
 * - Multi-provider support (email + Google + future providers)
 * - Refresh token lifecycle
 * - Email verification
 * - Password reset
 * - Onboarding tracking
 * - Security metadata
 * 
 * Backward compatible with existing password-only users
 */
const userSchema = new mongoose.Schema(
  {
    // Identity
    name: {
      type: String,
      required: true,
      trim: true
    },
    
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    // Authentication Methods
    // password: optional (for email/password auth)
    // kept optional for backward compatibility with Google users
    password: {
      type: String,
      default: null,
      select: false // Don't return by default
    },

    // Providers array: track all auth methods linked to this user
    // Example: [
    //   { type: 'email', verified: true, metadata: {} },
    //   { type: 'google', sub: '..._id', email: 'user@gmail.com', verified: true, metadata: { ... } }
    // ]
    providers: [
      {
        type: {
          type: String,
          enum: ['email', 'google'],
          required: true
        },
        
        // Google OAuth sub (unique to Google, per project)
        sub: {
          type: String,
          sparse: true,
          index: true
        },
        
        // Whether this provider is verified/authenticated
        verified: {
          type: Boolean,
          default: true // Google is auto-verified
        },
        
        // Provider-specific metadata
        metadata: {
          email: String, // Provider's email claim
          name: String,  // Provider's name claim
          picture: String, // Provider's picture
          locale: String,
          connectedAt: Date
        },
        
        _id: false
      }
    ],

    // Email verification
    emailVerified: {
      type: Boolean,
      default: false
    },
    
    emailVerificationToken: {
      type: String,
      select: false
    },
    
    emailVerificationTokenExpiry: Date,

    // Password reset
    passwordResetToken: {
      type: String,
      select: false
    },
    
    passwordResetTokenExpiry: Date,

    // Profile
    profilePicture: {
      type: String,
      default: null
    },
    
    avatar: {
      type: String,
      default: null
    },

    // Refresh token lifecycle
    // Store refresh token hashes to enable logout/revocation
    refreshTokens: [
      {
        tokenHash: {
          type: String,
          required: true
        },
        
        expiresAt: Date,
        
        createdAt: {
          type: Date,
          default: Date.now
        },
        
        revokedAt: Date,
        
        // For debugging: which device/IP created this token
        ipAddress: String,
        userAgent: String,
        
        _id: false
      }
    ],

    // Onboarding state
    onboardingCompleted: {
      type: Boolean,
      default: false
    },
    
    onboardingCompletedAt: Date,

    // Account status
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    
    deactivatedAt: Date,

    // Security & Audit
    lastLoginAt: Date,
    
    lastLoginIp: String,
    
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    
    accountLockedUntil: Date,

    // When was password last changed
    lastPasswordChangeAt: Date,

    // For audit trail
    updatedBy: String, // 'user' | 'admin' | 'system'

    // ─────────────────────────────────────────────────────────────────────
    // Billing (centralized TTT Payment Service integration)
    //
    // NetTwin uses a per-user subscription model (no Organization). The
    // `plan` block is the source of truth for feature limits enforced by
    // src/modules/billing/billing.middleware.js. The `subscription` block
    // tracks the lifecycle bits owned by the centralized payment service.
    //
    // Both blocks are written by the activation webhook from TTT — see
    // src/modules/billing/billing.integration.controller.js.
    // ─────────────────────────────────────────────────────────────────────
    plan: {
      slug: { type: String, default: "free" },
      name: { type: String, default: "Free" },
      price: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      // -1 means unlimited for any of the *Limit fields below.
      twinsLimit: { type: Number, default: -1 },
      messagesLimit: { type: Number, default: 200 },
      leadsLimit: { type: Number, default: -1 },
      status: { type: String, default: "active" }, // "active" | "past_due"
    },

    subscription: {
      centralBillingCustomerId: { type: String, default: null, index: true },
      status: {
        type: String,
        default: "inactive",
        enum: [
          "inactive",
          "active",
          "trial",
          "expired",
          "cancelled",
          "payment_failed",
        ],
      },
      // Start of the current 30-day usage window. Set on activation (paid)
      // or lazily on first quota check (free). Counted messages are those
      // with createdAt >= currentPeriodStart.
      currentPeriodStart: { type: Date, default: null },
      currentPeriodEnd: { type: Date, default: null },
      // When non-null, we've already sent the "limit reached" email to the
      // user for the current period. Cleared on period rollover so the next
      // exhaustion notifies again.
      limitNotifiedAt: { type: Date, default: null },
      lastSyncedAt: { type: Date, default: null },
      planId: { type: String, default: null }, // TTT plan cuid
    },
  },
  {
    timestamps: true,
    // Optimize for auth queries
    indexes: [
      { email: 1 },
      { 'providers.sub': 1 },
      { emailVerificationToken: 1 },
      { passwordResetToken: 1 },
      { createdAt: -1 }
    ]
  }
);

// Validation: ensure user has at least one auth method
userSchema.pre('save', function(next) {
  const hasPassword = this.password && this.password.trim() !== '';
  const hasProvider = this.providers && this.providers.length > 0;
  
  if (!hasPassword && !hasProvider) {
    next(new Error('User must have either password or provider authentication'));
  } else {
    next();
  }
});

// Ensure email is always lowercase
userSchema.pre('save', function(next) {
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Clean up expired refresh tokens on save
userSchema.pre('save', function(next) {
  if (this.refreshTokens) {
    const now = new Date();
    this.refreshTokens = this.refreshTokens.filter(
      token => token.expiresAt > now && !token.revokedAt
    );
  }
  next();
});

// Handle concurrent saves
userSchema.set('timestamps', true);

export default mongoose.model('User', userSchema);