// src/modules/billing/billing.middleware.js
// Feature-gate middleware for NetTwin. Applied to feature-creating routes
// (twin creation, chatbot messaging, lead capture) to enforce plan limits.

import DigitalTwin from "../../models/DigitalTwin.js";
import Lead from "../../models/Lead.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { getEffectivePlanLimits, isSubscriptionActive } from "./billing.utils.js";

/** Resolve a fresh User (with subscription/plan fields) once per request. */
const resolveUser = async (req) => {
  if (req._billingUser) return req._billingUser;
  const user = await User.findById(req.user._id).lean();
  req._billingUser = user;
  return user;
};

const quotaError = (res, { feature, used, limit }) =>
  res.status(429).json({
    success: false,
    error: "QUOTA_EXCEEDED",
    message: `${feature} limit reached (${limit}). Upgrade your plan to continue.`,
    current: used,
    limit,
    redirectTo: "/billing",
  });

/**
 * Block twin creation when the user is at their plan's twinsLimit.
 *
 * `POST /api/digital-twin/create` is now a TRUE create (the controller used
 * to upsert, which made the quota meaningless — every "Create another"
 * silently overwrote the existing twin). With the controller fixed and the
 * unique-on-user index dropped, this check is the single source of truth
 * for "can this user create one more twin?":
 *
 *   free plan → twinsLimit 1  →  block once they own 1
 *   pro plan  → twinsLimit 10 →  block once they own 10
 *   limit === -1 → unlimited  →  always allow
 *
 * Edits to an existing twin do NOT come through this route — they go
 * through PATCH /section (or future PUT /:id) which is not gated, so a
 * paid user updating their 7th twin still works regardless of quota.
 *
 * Race-safety note: between this count and the controller's insert,
 * another request from the same user could create a twin concurrently and
 * push us over the limit by one. For the FE-driven flow this is acceptable
 * (clicks are user-paced). If we ever expose programmatic bulk creation,
 * add a transaction or post-insert recount-and-rollback.
 */
export const canCreateTwin = async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const plan = getEffectivePlanLimits(user);
    const limit = plan.twinsLimit;
    if (limit === -1) return next(); // unlimited

    const used = await DigitalTwin.countDocuments({ user: user._id });
    if (used >= limit) {
      return quotaError(res, { feature: "Digital twin", used, limit });
    }
    return next();
  } catch (error) {
    console.error("[BILLING] canCreateTwin error:", error);
    return res.status(500).json({ success: false, message: "Error checking twin quota" });
  }
};

/**
 * Resolve the twin-owner user from a request. Public chatbot/lead routes
 * don't have req.user — we look up the owner via req.body.twinId or
 * req.params.twinId so visitor traffic is still metered against the right
 * account's quota.
 */
const resolveTwinOwner = async (req) => {
  if (req.user) return resolveUser(req);
  const twinId = req.body?.twinId || req.params?.twinId;
  if (!twinId) return null;
  const twin = await DigitalTwin.findById(twinId).select("user").lean();
  if (!twin) return null;
  return User.findById(twin.user).lean();
};

/** Count Leads/Messages tied to any twin owned by `user`. */
const countByTwinOwner = async (Model, user) => {
  const twinIds = await DigitalTwin.find({ user: user._id }).distinct("_id");
  if (!twinIds.length) return 0;
  return Model.countDocuments({ twinId: { $in: twinIds } });
};

/**
 * Block chatbot messaging when the twin owner is at their plan's messagesLimit.
 * Applied to the public chatbot route — visitor traffic counts against the
 * owner's quota.
 */
export const canSendChatMessage = async (req, res, next) => {
  try {
    const user = await resolveTwinOwner(req);
    if (!user) return next(); // can't resolve owner — don't block

    const plan = getEffectivePlanLimits(user);
    const limit = plan.messagesLimit;
    if (limit === -1) return next();
    const used = await countByTwinOwner(Message, user).catch(() => 0);
    if (used >= limit) return quotaError(res, { feature: "Chat message", used, limit });
    return next();
  } catch (error) {
    console.error("[BILLING] canSendChatMessage error:", error);
    return next(); // never hard-fail messaging on quota-check errors
  }
};

/** Block lead capture when the twin owner is at their plan's leadsLimit. */
export const canCreateLead = async (req, res, next) => {
  try {
    const user = await resolveTwinOwner(req);
    if (!user) return next();
    const plan = getEffectivePlanLimits(user);
    const limit = plan.leadsLimit;
    if (limit === -1) return next();
    const used = await countByTwinOwner(Lead, user).catch(() => 0);
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
    const user = await resolveUser(req);
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
