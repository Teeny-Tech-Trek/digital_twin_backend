// src/modules/billing/billing.controller.js
// Public-facing billing controller. The NetTwin frontend hits these.

import asyncHandler from "../../middleware/asyncHandler.js";
import User from "../../models/User.js";
import DigitalTwin from "../../models/DigitalTwin.js";
import Lead from "../../models/Lead.js";
import Message from "../../models/Message.js";
import {
  createOrderInCentral,
  getLatestPaymentForUser,
  getPlansFromCentral,
  syncUserWithCentral,
  updateLocalSubscriptionState,
  verifyPaymentInCentral,
} from "./billing.service.js";
import {
  BILLING_ERROR_CODES,
  PLAN_LIMITS,
  SUBSCRIPTION_PLANS,
} from "./billing.constants.js";
import {
  createBillingError,
  getDefaultFreePlan,
  getEffectivePlanLimits,
  isSubscriptionActive,
} from "./billing.utils.js";

const usagePercent = (used, limit) => {
  if (limit === -1) return 0; // unlimited
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
};

/**
 * GET /api/billing/plans
 * Public list of available plans (also includes the local Free plan so the
 * UI can render Free alongside paid plans even when TTT doesn't store it).
 */
export const getPlans = asyncHandler(async (_req, res) => {
  const centralPlans = await getPlansFromCentral();

  // Ensure Free always appears in the UI — it's NetTwin-owned, not in TTT.
  const hasFree = centralPlans.some((p) => p.slug === SUBSCRIPTION_PLANS.FREE);
  const free = PLAN_LIMITS[SUBSCRIPTION_PLANS.FREE];
  const plans = hasFree
    ? centralPlans
    : [
        {
          id: "local-free",
          slug: free.slug,
          name: free.name,
          price: free.price,
          currency: free.currency,
          twinsLimit: free.twinsLimit,
          messagesLimit: free.messagesLimit,
          leadsLimit: free.leadsLimit,
          features: free.features,
          isPopular: false,
        },
        ...centralPlans,
      ];

  res.json({ success: true, plans });
});

/**
 * GET /api/billing/status
 * Current plan, subscription, and usage counters for the authenticated user.
 */
export const getBillingStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const effectivePlan = getEffectivePlanLimits(user);

  // Lead and Message reference twinId, not user — resolve the user's twin ids
  // first so usage counts are accurate.
  const twinIds = await DigitalTwin.find({ user: user._id }).distinct("_id");
  const [twinCount, leadCount, messageCount] = await Promise.all([
    Promise.resolve(twinIds.length),
    twinIds.length
      ? Lead.countDocuments({ twinId: { $in: twinIds } }).catch(() => 0)
      : 0,
    twinIds.length
      ? Message.countDocuments({ twinId: { $in: twinIds } }).catch(() => 0)
      : 0,
  ]);

  const usage = {
    twins: {
      used: twinCount,
      limit: effectivePlan.twinsLimit,
      percent: usagePercent(twinCount, effectivePlan.twinsLimit),
    },
    messages: {
      used: messageCount,
      limit: effectivePlan.messagesLimit,
      percent: usagePercent(messageCount, effectivePlan.messagesLimit),
    },
    leads: {
      used: leadCount,
      limit: effectivePlan.leadsLimit,
      percent: usagePercent(leadCount, effectivePlan.leadsLimit),
    },
  };

  res.json({
    success: true,
    plan: {
      slug: effectivePlan.slug,
      name: effectivePlan.name,
      price: effectivePlan.price,
      currency: effectivePlan.currency || "INR",
      twinsLimit: effectivePlan.twinsLimit,
      messagesLimit: effectivePlan.messagesLimit,
      leadsLimit: effectivePlan.leadsLimit,
    },
    subscription: {
      status: user.subscription?.status || "inactive",
      isActive: isSubscriptionActive(user.subscription),
      currentPeriodEnd: user.subscription?.currentPeriodEnd || null,
      centralCustomerId: user.subscription?.centralBillingCustomerId || null,
      lastSyncedAt: user.subscription?.lastSyncedAt || null,
      planId: user.subscription?.planId || null,
    },
    usage,
  });
});

/**
 * POST /api/billing/initialize
 * Idempotent: pins the user's TTT customer id to their User._id so subsequent
 * create-order calls have a stable identifier to reference.
 */
export const initializeBilling = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (user.subscription?.centralBillingCustomerId) {
    return res.json({
      success: true,
      customerId: user.subscription.centralBillingCustomerId,
      message: "User already synced with billing service",
    });
  }

  const customerId = await syncUserWithCentral(user);

  // Seed the subscription block with an inactive Free placeholder. Once the
  // user pays, the activation callback overwrites these fields.
  const free = getDefaultFreePlan();
  user.subscription = {
    centralBillingCustomerId: customerId,
    status: "inactive",
    lastSyncedAt: new Date(),
    currentPeriodEnd: null,
    planId: null,
  };
  if (!user.plan?.slug) {
    user.plan = {
      slug: free.slug,
      name: free.name,
      price: free.price,
      currency: free.currency,
      twinsLimit: free.twinsLimit,
      messagesLimit: free.messagesLimit,
      leadsLimit: free.leadsLimit,
      status: "active",
    };
  }
  await user.save();

  res.json({
    success: true,
    customerId,
    message: "User synced with billing service",
  });
});

/**
 * POST /api/billing/create-order
 * Creates the Razorpay order in TTT and returns the data the frontend needs
 * to open the Razorpay checkout popup.
 */
export const createOrder = asyncHandler(async (req, res) => {
  // Defensive: a missing/non-JSON body would otherwise crash destructuring
  // with a 500. Reject early with a clean 400.
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST",
      message: "Request body must be a JSON object with a 'planId' field",
    });
  }
  const { planId } = req.body;
  if (!planId) {
    throw createBillingError(
      BILLING_ERROR_CODES.INVALID_REQUEST,
      "planId is required",
      400
    );
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Auto-initialize the TTT mapping if we haven't yet — TTT has no separate
  // customer-create endpoint, so the only "registration" is pinning the id.
  if (!user.subscription?.centralBillingCustomerId) {
    const customerId = await syncUserWithCentral(user);
    user.subscription = {
      ...(user.subscription?.toObject?.() || user.subscription || {}),
      centralBillingCustomerId: customerId,
      status: user.subscription?.status || "inactive",
      lastSyncedAt: new Date(),
    };
    await user.save();
  }

  const order = await createOrderInCentral(user._id, planId, {
    userName: user.name,
    userEmail: user.email,
  });

  res.json({ success: true, order });
});

/**
 * POST /api/billing/verify-payment
 * Polls TTT to confirm Razorpay captured the payment. The activation webhook
 * is the authoritative state-update path; this endpoint is the synchronous
 * UX fallback for "verifying..." after Razorpay's popup closes.
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      success: false,
      message: "orderId, paymentId, and signature are required",
    });
  }

  const verifyResult = await verifyPaymentInCentral(orderId, paymentId, signature);

  // Re-read the user in case the activation webhook already ran in parallel.
  const fresh = await User.findById(req.user._id).lean();
  res.json({
    success: true,
    message: "Payment verified successfully",
    subscription: fresh?.subscription || null,
    plan: fresh?.plan || null,
    subscription_status:
      fresh?.subscription?.status || verifyResult.subscription_status,
    payment: verifyResult.payment,
  });
});

/**
 * POST /api/billing/sync-subscription
 * Fetches the user's latest TTT payment and applies it locally. Used as a
 * manual reconciliation button and after long offline windows.
 */
export const syncSubscription = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!user.subscription?.centralBillingCustomerId) {
    throw createBillingError(
      BILLING_ERROR_CODES.INVALID_REQUEST,
      "User not synced with billing service",
      400
    );
  }

  const latest = await getLatestPaymentForUser(user._id);
  if (!latest || latest.status !== "paid") {
    return res.json({
      success: true,
      message: "No paid subscription found",
      subscription: user.subscription,
    });
  }

  // TTT's latest-payment response embeds the plan inline. We pass it through
  // updateLocalSubscriptionState so the normalization + slug logic lives in
  // one place.
  await updateLocalSubscriptionState(user._id, {
    customerId: user._id.toString(),
    planId: latest.planId,
    status: "paid",
    currentPeriodEnd: latest.currentPeriodEnd,
    planSlug: latest.plan?.slug,
    metadata: latest.metadata,
  });

  const refreshed = await User.findById(user._id).lean();
  res.json({
    success: true,
    message: "Subscription synced successfully",
    subscription: refreshed.subscription,
    plan: refreshed.plan,
  });
});

/**
 * GET /api/billing/invoices
 * Stubbed — TTT doesn't expose invoices yet. Returns [] so the UI doesn't break.
 */
export const getInvoices = asyncHandler(async (_req, res) => {
  res.json({ success: true, invoices: [] });
});

/**
 * GET /api/billing/customer-info
 * Lightweight identity echo — useful for the UI to confirm the user is
 * registered with the billing service.
 */
export const getCustomerInfo = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  res.json({
    success: true,
    customer: user.subscription?.centralBillingCustomerId
      ? {
          customerId: user.subscription.centralBillingCustomerId,
          product: "nettwin",
          name: user.name,
          email: user.email,
        }
      : null,
  });
});
