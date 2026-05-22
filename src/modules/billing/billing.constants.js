// src/modules/billing/billing.constants.js
// NetTwin billing constants. Mirrors NexEstate's module so the contract with
// the centralized TTT Payment Service stays identical across products.
//
// Two important divergences from NexEstate:
//   1) NetTwin has NO Organization model — subscription lives on User.
//      The TTT contract still uses `userId` (we pass user._id.toString()) and
//      reuses `organizationId` for the same value on the activation callback.
//   2) NetTwin defines its own plan limits LOCALLY (PLAN_LIMITS map below)
//      so the central TTT schema stays product-agnostic. TTT only stores
//      slug/name/price/durationDays for nettwin plans; this file is the
//      source of truth for what each slug entitles a user to.

// Central Billing Service configuration -----------------------------------
// Plain process.env reads (NetTwin doesn't have a getOptional helper like
// NexEstate; defaults preserved for local dev).
export const CENTRAL_BILLING_SERVICE_URL =
  process.env.CENTRAL_BILLING_SERVICE_URL || "http://localhost:4000";

export const CENTRAL_BILLING_API_KEY =
  process.env.CENTRAL_BILLING_API_KEY || "dev-key-12345";

export const CENTRAL_BILLING_INTERNAL_KEY =
  process.env.CENTRAL_BILLING_INTERNAL_API_KEY || "internal-dev-key-12345";

// Product identity this NetTwin instance uses when calling TTT.
// MUST match TTT's seeded Plan.product value for nettwin plans and the
// key registered in TTT's src/config/productEndpoints.js.
export const TTT_PRODUCT_ID = "nettwin";

// TTT public surface (v1). Unchanged from NexEstate so future products can
// share the contract verbatim.
export const CENTRAL_SERVICE_ENDPOINTS = {
  CREATE_ORDER: "/api/v1/payments/create-order",
  PAYMENT_STATUS: "/api/v1/payments/:paymentId/status",
  PAYMENT_BY_ORDER: "/api/v1/payments/razorpay/:razorpayOrderId",
  LATEST_PAYMENT_FOR_USER: "/api/v1/payments/user/:userId/latest",
  GET_PLANS: "/api/v1/plans",
};

// Subscription plan slugs. Four tiers at launch:
//   free       — default for every signup (no payment)
//   starter    — ₹999 / month
//   pro        — ₹1,999 / month
//   enterprise — contact sales (no Razorpay flow)
export const SUBSCRIPTION_PLANS = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  ENTERPRISE: "enterprise",
};

// NetTwin's local plan-limit map, keyed by slug. This is the authoritative
// source for feature gating; TTT only stores name/slug/price/durationDays
// for nettwin plans (NetTwin owns the feature semantics, TTT owns billing).
//
// All plans give unlimited digital twins and unlimited lead capture.
// Differentiation is on the chatbot-message quota only.
//   Free       — 200 messages / month
//   Starter    — 5,000 messages / month
//   Pro        — 12,000 messages / month
//   Enterprise — custom (limit = -1 once activated)
//
// Period is a rolling 30-day window starting at subscription activation
// (or signup, for free users). See billing.utils.ensureCurrentBillingPeriod.
export const PLAN_LIMITS = {
  [SUBSCRIPTION_PLANS.FREE]: {
    name: "Free",
    slug: "free",
    price: 0, // paise
    currency: "INR",
    twinsLimit: -1, // unlimited digital twins
    messagesLimit: 200, // chatbot messages per 30-day period
    leadsLimit: -1, // unlimited leads
    isContactOnly: false,
    // `features` is the EXTRAS list — not a re-statement of the
    // twin/message/lead limits, which the UI renders from their dedicated
    // fields. Keep entries unique to each tier to avoid duplicate lines.
    features: ["Public twin sharing", "QR code distribution"],
  },
  [SUBSCRIPTION_PLANS.STARTER]: {
    name: "Starter",
    slug: "starter",
    price: 99900, // ₹999 in paise
    currency: "INR",
    twinsLimit: -1,
    messagesLimit: 5000,
    leadsLimit: -1,
    isContactOnly: false,
    features: ["Email support", "Lead export (CSV)"],
  },
  [SUBSCRIPTION_PLANS.PRO]: {
    name: "Pro",
    slug: "pro",
    price: 199900, // ₹1,999 in paise
    currency: "INR",
    twinsLimit: -1,
    messagesLimit: 12000,
    leadsLimit: -1,
    isContactOnly: false,
    features: [
      "Priority email support",
      "Lead export (CSV)",
      "Remove NetTwin branding",
    ],
  },
  [SUBSCRIPTION_PLANS.ENTERPRISE]: {
    name: "Enterprise",
    slug: "enterprise",
    price: 0, // contact sales — no Razorpay flow
    currency: "INR",
    twinsLimit: -1,
    messagesLimit: -1, // unlimited once contracted
    leadsLimit: -1,
    isContactOnly: true,
    features: [
      "Dedicated success manager",
      "Custom integrations",
      "SLAs and uptime guarantees",
      "On-prem / VPC deployment",
    ],
  },
};

// Subscription status enum. Matches NexEstate so the activation callback
// payload shape is identical.
export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  TRIAL: "trial",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  PAYMENT_FAILED: "payment_failed",
};

// Standard billing error codes (mirrors NexEstate).
export const BILLING_ERROR_CODES = {
  SERVICE_UNAVAILABLE: "BILLING_SERVICE_UNAVAILABLE",
  INVALID_PLAN: "INVALID_PLAN",
  NO_SUBSCRIPTION: "NO_SUBSCRIPTION",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  INVALID_REQUEST: "INVALID_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
};

// Sync cadence — re-pull subscription state at most this often when a user
// hits a feature gate.
export const BILLING_SYNC_CONFIG = {
  SYNC_BEFORE_FEATURE_GATE_MS: 300_000, // 5 min
};
