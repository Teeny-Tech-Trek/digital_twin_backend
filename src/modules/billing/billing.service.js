// src/modules/billing/billing.service.js
// HTTP client wrapping the centralized TTT Payment Service.
//
// Architecture notes (mirrors NexEstate):
//   * TTT is product-agnostic. We identify ourselves on every request with
//     `product: "nettwin"` + `userId: user._id.toString()`.
//   * TTT public endpoints (create-order, payment status by id) need no auth.
//   * Internal/admin endpoints (plans CRUD, lookups by razorpay order id,
//     latest-payment-for-user) require `x-internal-api-key`.
//   * Activation is webhook-driven. TTT calls back into NetTwin at
//     POST /api/billing/internal/activate-plan with the shared internal key
//     after Razorpay confirms payment.captured.

import axios from "axios";
import User from "../../models/User.js";
import {
  BILLING_ERROR_CODES,
  CENTRAL_BILLING_INTERNAL_KEY,
  CENTRAL_BILLING_SERVICE_URL,
  CENTRAL_SERVICE_ENDPOINTS,
  PLAN_LIMITS,
  TTT_PRODUCT_ID,
} from "./billing.constants.js";
import {
  createBillingError,
  extractBillingError,
  normalizeUserId,
} from "./billing.utils.js";

/** Build an axios client pinned to TTT. internalRequest adds the shared key. */
const createBillingClient = (internalRequest = false) => {
  const headers = {
    "Content-Type": "application/json",
    "X-Service": TTT_PRODUCT_ID,
  };
  if (internalRequest) {
    headers["x-internal-api-key"] = CENTRAL_BILLING_INTERNAL_KEY;
  }
  return axios.create({
    baseURL: CENTRAL_BILLING_SERVICE_URL,
    headers,
    timeout: 10_000,
  });
};

/**
 * Fetch nettwin's plans from TTT. The response shape from TTT is
 *   { success, data: { product, plans: [...] } }
 * Each plan has at minimum: { id, slug, name, price, currency, durationDays }.
 * NetTwin merges these with PLAN_LIMITS so the frontend gets both pricing
 * (from TTT, the source of truth) and feature lists (NetTwin-owned).
 */
export const getPlansFromCentral = async () => {
  try {
    const client = createBillingClient(true);
    const response = await client.get(CENTRAL_SERVICE_ENDPOINTS.GET_PLANS, {
      params: { product: TTT_PRODUCT_ID },
    });
    const plans = response.data?.data?.plans;
    if (!Array.isArray(plans)) {
      throw createBillingError(
        BILLING_ERROR_CODES.INVALID_REQUEST,
        "Invalid plans response from TTT Payment Service",
        502
      );
    }
    return plans.map((plan) => {
      const slug = String(plan.slug || "").toLowerCase();
      const localLimits = PLAN_LIMITS[slug] || {};
      return {
        id: plan.id,
        slug,
        name: plan.name || localLimits.name,
        price: plan.price ?? localLimits.price ?? 0,
        currency: plan.currency || "INR",
        durationDays: plan.durationDays,
        twinsLimit: localLimits.twinsLimit,
        messagesLimit: localLimits.messagesLimit,
        leadsLimit: localLimits.leadsLimit,
        features: localLimits.features || [],
        isPopular: slug === "pro",
      };
    });
  } catch (error) {
    if (error.code) throw error;
    console.error("[BILLING] Error fetching plans:", error.message);
    throw createBillingError(
      BILLING_ERROR_CODES.SERVICE_UNAVAILABLE,
      "Unable to fetch billing plans",
      503,
      { originalError: extractBillingError(error) }
    );
  }
};

/** Resolve a plan slug (e.g. "pro") or a TTT cuid to the full TTT plan. */
export const resolvePlanByIdOrSlug = async (planIdOrSlug) => {
  if (!planIdOrSlug) {
    throw createBillingError(
      BILLING_ERROR_CODES.INVALID_PLAN,
      "Plan identifier is required"
    );
  }
  const plans = await getPlansFromCentral();
  const needle = String(planIdOrSlug).toLowerCase();
  const match =
    plans.find((p) => p.id === planIdOrSlug) ||
    plans.find((p) => p.slug === needle) ||
    plans.find((p) => String(p.name).toLowerCase() === needle);
  if (!match) {
    throw createBillingError(
      BILLING_ERROR_CODES.INVALID_PLAN,
      `Plan '${planIdOrSlug}' not found for product ${TTT_PRODUCT_ID}`,
      404
    );
  }
  return match;
};

/**
 * Create a Razorpay order via TTT. Returns the data the frontend needs to
 * open the Razorpay checkout popup.
 *
 * TTT contract: POST /api/v1/payments/create-order
 *   body: { product, userId, planId }
 *   response.data: { paymentId, orderId, amount, currency, razorpayKey }
 */
export const createOrderInCentral = async (userId, planIdOrSlug, metadata = {}) => {
  try {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
      throw createBillingError(
        BILLING_ERROR_CODES.INVALID_REQUEST,
        "User ID is required"
      );
    }
    const plan = await resolvePlanByIdOrSlug(planIdOrSlug);
    const client = createBillingClient(false); // public endpoint

    const response = await client.post(CENTRAL_SERVICE_ENDPOINTS.CREATE_ORDER, {
      product: TTT_PRODUCT_ID,
      userId: normalizedUserId,
      planId: plan.id,
    });

    const data = response.data?.data;
    if (!data || !data.orderId) {
      throw createBillingError(
        BILLING_ERROR_CODES.INVALID_REQUEST,
        "Invalid order response from TTT Payment Service",
        502
      );
    }
    return {
      orderId: data.orderId,
      paymentId: data.paymentId,
      amount: data.amount,
      currency: data.currency,
      razorpayKey: data.razorpayKey,
      planId: plan.id,
      planSlug: plan.slug,
      planName: plan.name,
      customerId: normalizedUserId,
      metadata,
    };
  } catch (error) {
    if (error.code) throw error;
    console.error("[BILLING] Error creating order:", error.message);
    throw createBillingError(
      BILLING_ERROR_CODES.SERVICE_UNAVAILABLE,
      "Unable to create payment order",
      503,
      { originalError: extractBillingError(error) }
    );
  }
};

/**
 * Ask TTT whether a Razorpay order/payment has been captured. Used as a
 * synchronous fallback for the user-visible "verifying..." UX immediately
 * after Razorpay's popup closes — the authoritative state still arrives
 * via the activation webhook a moment later.
 */
export const checkPaymentStatusInCentral = async ({ paymentId, razorpayOrderId }) => {
  try {
    if (!paymentId && !razorpayOrderId) {
      throw createBillingError(
        BILLING_ERROR_CODES.INVALID_REQUEST,
        "paymentId or razorpayOrderId is required"
      );
    }
    let payment;
    if (paymentId) {
      const client = createBillingClient(false);
      const endpoint = CENTRAL_SERVICE_ENDPOINTS.PAYMENT_STATUS.replace(
        ":paymentId",
        paymentId
      );
      const response = await client.get(endpoint);
      payment = response.data?.data;
    } else {
      const client = createBillingClient(true);
      const endpoint = CENTRAL_SERVICE_ENDPOINTS.PAYMENT_BY_ORDER.replace(
        ":razorpayOrderId",
        razorpayOrderId
      );
      const response = await client.get(endpoint);
      payment = response.data?.data;
    }
    if (!payment) return { paid: false, status: "unknown", payment: null };
    return {
      paid: payment.status === "paid",
      status: payment.status,
      payment,
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return { paid: false, status: "not_found", payment: null };
    }
    if (error.code) throw error;
    console.error("[BILLING] Error checking payment status:", error.message);
    throw createBillingError(
      BILLING_ERROR_CODES.SERVICE_UNAVAILABLE,
      "Unable to check payment status",
      503,
      { originalError: extractBillingError(error) }
    );
  }
};

/** Polling-style verify used by the /verify-payment endpoint. */
export const verifyPaymentInCentral = async (orderId, _paymentId, _signature) => {
  const result = await checkPaymentStatusInCentral({ razorpayOrderId: orderId });
  if (!result.paid) {
    throw createBillingError(
      BILLING_ERROR_CODES.PAYMENT_FAILED,
      `Payment not captured yet (status: ${result.status})`,
      402
    );
  }
  return {
    verified: true,
    subscription_status: "active",
    payment: result.payment,
  };
};

/**
 * Latest TTT payment for a NetTwin user. Used to backfill subscription
 * state if the activation webhook was missed (e.g. webhook delivery
 * failure during deploy). Returns null on 404 / errors so callers can
 * fail soft.
 */
export const getLatestPaymentForUser = async (userId) => {
  try {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return null;
    const client = createBillingClient(true);
    const endpoint = CENTRAL_SERVICE_ENDPOINTS.LATEST_PAYMENT_FOR_USER.replace(
      ":userId",
      normalizedUserId
    );
    const response = await client.get(endpoint, {
      params: { product: TTT_PRODUCT_ID },
    });
    return response.data?.data || null;
  } catch (error) {
    if (error.response?.status === 404) return null;
    console.warn("[BILLING] getLatestPaymentForUser failed:", error.message);
    return null;
  }
};

/**
 * "Sync" a user with TTT. TTT has no separate customer-registration call,
 * so this is a local idempotent op that pins `user.subscription.centralBillingCustomerId = user._id`
 * so create-order can proceed. Mirrors NexEstate's syncOrganizationWithCentral.
 */
export const syncUserWithCentral = async (user) => {
  if (!user?._id) {
    throw createBillingError(
      BILLING_ERROR_CODES.INVALID_REQUEST,
      "User is required"
    );
  }
  return user._id.toString();
};

/**
 * Apply an activation payload to a user document. Called both by the
 * activation callback handler and (potentially) by the manual sync path.
 *
 * Behavior:
 *   - Normalizes TTT's `paid` status to local `active`.
 *   - Persists plan slug (preferred for UI rendering) and TTT plan cuid.
 *   - Pulls the feature limits from PLAN_LIMITS (NetTwin-local) — TTT's
 *     planFeatures payload is intentionally ignored here so the centralized
 *     service stays product-agnostic.
 */
export const updateLocalSubscriptionState = async (userId, subscriptionData) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw createBillingError(
      BILLING_ERROR_CODES.INVALID_REQUEST,
      "User ID is required"
    );
  }
  const user = await User.findById(normalizedUserId);
  if (!user) {
    throw createBillingError(
      BILLING_ERROR_CODES.INVALID_REQUEST,
      "User not found",
      404
    );
  }

  const incomingStatus = subscriptionData.status;
  const normalizedStatus =
    incomingStatus === "paid" ? "active" : incomingStatus || "active";

  // Resolve the slug the user just paid for. TTT passes the cuid in `planId`
  // and the human-readable slug in metadata.planSlug; if metadata is missing
  // we fall back to whatever's already on the user.
  const incomingSlug =
    subscriptionData.planSlug ||
    subscriptionData.metadata?.planSlug ||
    user.plan?.slug ||
    "pro";

  const localLimits = PLAN_LIMITS[String(incomingSlug).toLowerCase()] || PLAN_LIMITS.pro;

  user.subscription = {
    centralBillingCustomerId:
      subscriptionData.customerId ||
      user.subscription?.centralBillingCustomerId ||
      normalizedUserId,
    status: normalizedStatus,
    currentPeriodEnd: subscriptionData.currentPeriodEnd
      ? new Date(subscriptionData.currentPeriodEnd)
      : user.subscription?.currentPeriodEnd || null,
    lastSyncedAt: new Date(),
    planId: subscriptionData.planId || user.subscription?.planId || null,
  };

  user.plan = {
    slug: String(incomingSlug).toLowerCase(),
    name: localLimits.name,
    price: localLimits.price ?? user.plan?.price ?? 0,
    currency: localLimits.currency || "INR",
    twinsLimit: localLimits.twinsLimit,
    messagesLimit: localLimits.messagesLimit,
    leadsLimit: localLimits.leadsLimit,
    status: normalizedStatus === "active" ? "active" : "past_due",
  };

  await user.save();
  return user;
};
