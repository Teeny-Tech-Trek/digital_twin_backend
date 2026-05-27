// src/modules/billing/billing.middleware.js
// Feature-gate middleware for NetTwin. Applied to feature-creating routes
// (twin creation, chatbot messaging, lead capture) to enforce plan limits.

import DigitalTwin from "../../models/DigitalTwin.js";
import Lead from "../../models/Lead.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import emailService from "../auth/services/emailService.js";
import {
  ensureCurrentBillingPeriod,
  getEffectivePlanLimits,
  isSubscriptionActive,
} from "./billing.utils.js";

/** Resolve a fresh User document (with subscription/plan fields). */
const resolveUserDoc = async (req) => {
  if (req._billingUserDoc) return req._billingUserDoc;
  const user = await User.findById(req.user._id);
  req._billingUserDoc = user;
  return user;
};

const quotaError = (res, { feature, used, limit }) =>
  res.status(429).json({
    success: false,
    error: "QUOTA_EXCEEDED",
    message:
      feature === "Chat message"
        ? "This digital twin is currently not available. The owner has reached their monthly chat-message limit."
        : `${feature} limit reached (${limit}). Upgrade your plan to continue.`,
    current: used,
    limit,
    redirectTo: "/billing",
  });

// canCreateTwin removed. Product decision: every user gets exactly one
// twin regardless of plan. The unique index on DigitalTwin.user is the
// enforcement mechanism; no middleware quota is needed. If multi-twin
// support is ever reintroduced, restore the middleware from git history.

/**
 * Resolve the twin-owner user (as a Mongoose document, so the period helper
 * can mutate-and-save). Public chatbot/lead routes don't have req.user — we
 * look up the owner via req.body.twinId or req.params.twinId so visitor
 * traffic still meters against the right account.
 */
const resolveTwinOwnerDoc = async (req) => {
  if (req.user) return resolveUserDoc(req);
  const twinId = req.body?.twinId || req.params?.twinId;
  if (!twinId) return null;
  const twin = await DigitalTwin.findById(twinId).select("user").lean();
  if (!twin) return null;
  return User.findById(twin.user);
};

/** Count messages or leads tied to any twin owned by `user` within [since, now]. */
const countByTwinOwner = async (Model, user, since, extraFilter = {}) => {
  const twinIds = await DigitalTwin.find({ user: user._id }).distinct("_id");
  if (!twinIds.length) return 0;
  const filter = { twinId: { $in: twinIds }, ...extraFilter };
  if (since) filter.createdAt = { $gte: since };
  return Model.countDocuments(filter);
};

/**
 * Block chatbot messaging when the twin owner has hit their per-period
 * messagesLimit. Public route — quota is metered against the owner via
 * req.body.twinId. On first exhaustion in a period, also fires off a
 * "limit reached" email to the owner (fire-and-forget — never blocks the
 * HTTP response).
 */
export const canSendChatMessage = async (req, res, next) => {
  try {
    const userDoc = await resolveTwinOwnerDoc(req);
    if (!userDoc) return next(); // can't resolve owner — don't block

    const user = await ensureCurrentBillingPeriod(userDoc);
    const plan = getEffectivePlanLimits(user);
    const limit = plan.messagesLimit;
    if (limit === -1) return next();

    const periodStart = user.subscription?.currentPeriodStart || null;
    // Count only visitor (user-role) messages — assistant replies are output,
    // not billable input. Matches the UX of "200 messages" being 200 turns.
    const used = await countByTwinOwner(Message, user, periodStart, { role: "user" }).catch(
      () => 0
    );

    if (used >= limit) {
      // One email per period — fire-and-forget so chat path stays fast.
      if (!user.subscription?.limitNotifiedAt) {
        user.subscription.limitNotifiedAt = new Date();
        user.save().catch((err) =>
          console.warn("[BILLING] Could not persist limitNotifiedAt:", err.message)
        );
        emailService
          .sendLimitReachedEmail(user, {
            used,
            limit,
            planName: plan.name,
            periodEnd: user.subscription?.currentPeriodEnd,
          })
          .catch((err) =>
            console.warn("[BILLING] sendLimitReachedEmail failed:", err.message)
          );
      }
      return quotaError(res, { feature: "Chat message", used, limit });
    }
    return next();
  } catch (error) {
    console.error("[BILLING] canSendChatMessage error:", error);
    return next(); // never hard-fail messaging on quota-check errors
  }
};

/** Block lead capture when the twin owner is at their plan's leadsLimit. */
export const canCreateLead = async (req, res, next) => {
  try {
    const userDoc = await resolveTwinOwnerDoc(req);
    if (!userDoc) return next();
    const user = await ensureCurrentBillingPeriod(userDoc);
    const plan = getEffectivePlanLimits(user);
    const limit = plan.leadsLimit;
    if (limit === -1) return next();
    const periodStart = user.subscription?.currentPeriodStart || null;
    const used = await countByTwinOwner(Lead, user, periodStart).catch(() => 0);
    if (used >= limit) return quotaError(res, { feature: "Lead", used, limit });
    return next();
  } catch (error) {
    console.error("[BILLING] canCreateLead error:", error);
    return next();
  }
};

/** Hard block on routes that require any paid plan (e.g. remove-branding). */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const user = await resolveUserDoc(req);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!isSubscriptionActive(user.subscription)) {
      return res.status(402).json({
        success: false,
        error: "SUBSCRIPTION_REQUIRED",
        message: "Active subscription required",
        redirectTo: "/billing",
      });
    }
    return next();
  } catch (error) {
    console.error("[BILLING] requireActiveSubscription error:", error);
    return res.status(500).json({ success: false, message: "Error validating subscription" });
  }
};
