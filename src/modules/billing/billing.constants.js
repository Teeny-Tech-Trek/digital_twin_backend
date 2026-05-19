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

// Subscription plan slugs. Only Free + Pro at launch; Enterprise reserved
// for a future tier so the rest of the codebase can already reference it.
export const SUBSCRIPTION_PLANS = {
  FREE: "free",
  PRO: "pro",
};

// NetTwin's local plan-limit map, keyed by slug. This is the authoritative
// source for feature gating; TTT's Plan.seats/agentsLimit/propertiesLimit
// columns are ignored for nettwin (kept null in the seeded TTT rows).
//
// Limit shape is NetTwin-native (twins / messages / leads), not real-estate
// (agents / properties / seats). NetTwin is a single-user product, so
// `seats` is always 1 and not exposed in the UI.
export const PLAN_LIMITS = {
  [SUBSCRIPTION_PLANS.FREE]: {
    name: "Free",
    slug: "free",
    price: 0, // paise
    currency: "INR",
    twinsLimit: 1,
    messagesLimit: 50, // chatbot messages per billing period
    leadsLimit: 10,
    features: [
      "1 digital twin",
      "50 chatbot messages / month",
      "10 leads captured",
      "Public twin sharing",
    ],
  },
  [SUBSCRIPTION_PLANS.PRO]: {
    name: "Pro",
    slug: "pro",
    price: 49900, // ₹499 in paise
    currency: "INR",
    twinsLimit: 10,
    messagesLimit: -1, // -1 means unlimited
    leadsLimit: 500,
    features: [
      "10 digital twins",
      "Unlimited chatbot messages",
      "500 leads captured",
      "Priority email support",
      "Remove NetTwin branding",
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
