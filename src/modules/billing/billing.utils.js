// src/modules/billing/billing.utils.js
// Shared helpers for the NetTwin billing module.

import {
  BILLING_ERROR_CODES,
  CENTRAL_BILLING_INTERNAL_KEY,
  PLAN_LIMITS,
  SUBSCRIPTION_PLANS,
} from "./billing.constants.js";

/** Create a standardized billing error that the global error handler can render. */
export const createBillingError = (
  code,
  message,
  statusCode = 400,
  details = {}
) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

/** Pull a readable message out of an axios/native error for logging. */
export const extractBillingError = (error) => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message) return error.message;
  return "Unknown billing service error";
};

/** Stringify a user/org id consistently. */
export const normalizeUserId = (id) => {
  if (!id) return null;
  return typeof id === "string" ? id : id.toString();
};

/** Constant-time-ish check on the shared internal API key. */
export const verifyInternalApiKey = (apiKey) => {
  if (!apiKey || !CENTRAL_BILLING_INTERNAL_KEY) return false;
  return apiKey === CENTRAL_BILLING_INTERNAL_KEY;
};

/** The free plan limits as a plain object — used as the fallback everywhere. */
export const getDefaultFreePlan = () => ({
  ...PLAN_LIMITS[SUBSCRIPTION_PLANS.FREE],
});

/**
 * Effective limits for a user. If they have an active paid plan and the slug
 * is known to NetTwin, return that plan's limits; otherwise free.
 *
 * This is the function feature-gate middleware should rely on so that paid
 * users automatically get the right ceilings without any per-plan branching.
 */
export const getEffectivePlanLimits = (user) => {
  const free = getDefaultFreePlan();
  if (!user?.plan?.slug) return free;

  const slug = String(user.plan.slug).toLowerCase();
  const matched = PLAN_LIMITS[slug];
  if (!matched) return free;

  // If the subscription has expired, fall back to free regardless of stored slug.
  if (!isSubscriptionActive(user.subscription)) {
    return free;
  }

  return matched;
};

/** True when subscription.status is active/trial and not past currentPeriodEnd. */
export const isSubscriptionActive = (subscription) => {
  if (!subscription || !subscription.status) return false;
  const active = ["active", "trial"];
  if (!active.includes(subscription.status)) return false;
  if (subscription.currentPeriodEnd) {
    return new Date(subscription.currentPeriodEnd) > new Date();
  }
  // Active status with no end date — treat as ongoing.
  return true;
};

/** Length of a free-plan billing window in milliseconds (30 days). */
export const FREE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Ensure `user.subscription.currentPeriodStart` / `currentPeriodEnd` describe
 * the user's CURRENT billing window. Mutates and saves the user document
 * when a rollover happens, then returns the (possibly refreshed) user.
 *
 * Rules:
 *   - Paid users: TTT's webhook sets both fields on activation; we only roll
 *     over here when the window has ended AND no fresh webhook has arrived
 *     (e.g. after subscription expiry). They fall back to a free-plan window.
 *   - Free users: rolling 30-day window from signup, advanced lazily on the
 *     first feature-gate check after the window ends. `limitNotifiedAt` is
 *     cleared so the new period can re-notify on exhaustion.
 *
 * Pass a Mongoose document (not a `.lean()` plain object) so we can save.
 * If a plain object is passed, this is a no-op (returns it unchanged) — the
 * caller is expected to do its own counting against the existing window.
 */
export const ensureCurrentBillingPeriod = async (user) => {
  if (!user || typeof user.save !== "function") return user;

  const now = new Date();
  const sub = user.subscription || {};
  const start = sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : null;
  const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;

  // Active paid window — nothing to roll over.
  if (start && end && now < end) return user;

  // Window missing or expired — open a fresh 30-day free window starting now.
  // Anchor to user.createdAt for first-ever rollover so usage prior to any
  // window setup (rare, only if Message rows pre-date this code) still counts.
  const anchorStart = start && now >= end ? end : user.createdAt || now;
  user.subscription = {
    ...(user.subscription?.toObject?.() || user.subscription || {}),
    currentPeriodStart: anchorStart,
    currentPeriodEnd: new Date(anchorStart.getTime() + FREE_PERIOD_MS),
    limitNotifiedAt: null,
  };
  await user.save();
  return user;
};

/** Format paise → human-readable currency string. */
export const formatPrice = (priceInPaise, currency = "INR") => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format((priceInPaise || 0) / 100);
};

/**
 * Validate the activation-callback payload sent by TTT.
 * For nettwin we don't require planFeatures (NetTwin owns the limits map),
 * but we do require organizationId/customerId/planId/status.
 */
export const validateActivationPayload = (payload = {}) => {
  const required = ["organizationId", "customerId", "planId", "status"];
  const missing = required.filter((f) => !payload[f]);
  if (missing.length) {
    return {
      valid: false,
      error: `Missing required fields: ${missing.join(", ")}`,
    };
  }
  return { valid: true };
};

/**
 * True when an incoming activation payload targets a user that's already on
 * the same paid plan with the same TTT customer id — so we skip re-applying.
 */
export const isActivationIdempotent = (user, activationPayload) => {
  if (!user?.subscription) return false;
  return (
    user.subscription.centralBillingCustomerId === activationPayload.customerId &&
    user.subscription.status === "active" &&
    user.subscription.planId === activationPayload.planId
  );
};

export { BILLING_ERROR_CODES };
