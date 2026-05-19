// src/modules/billing/billing.integration.controller.js
// Internal endpoints called by the TTT Payment Service after Razorpay events.

import User from "../../models/User.js";
import { updateLocalSubscriptionState } from "./billing.service.js";
import {
  isActivationIdempotent,
  validateActivationPayload,
  verifyInternalApiKey,
} from "./billing.utils.js";

/**
 * Extract the shared internal API key from the request. TTT's
 * productIntegrationService sets `x-internal-api-key` by default; we also
 * accept Authorization: Bearer <key> for parity with NexEstate.
 */
const extractInternalKey = (req) =>
  req.headers["x-internal-api-key"] ||
  (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

/**
 * POST /api/billing/internal/activate-plan
 *
 * Called by TTT after a `payment.captured` Razorpay webhook is processed.
 * See ttt-payment-service/src/services/productIntegrationService.js
 * (notifyProductPaymentSuccess) for the exact payload TTT sends:
 *
 *   {
 *     organizationId, customerId, planId,
 *     status: "paid",
 *     currentPeriodEnd: ISO string,
 *     metadata: { product, paymentId, razorpayPaymentId, planSlug, planName, ... },
 *     planFeatures: { seats, agentsLimit, propertiesLimit }   // ignored by nettwin
 *   }
 *
 * NetTwin's model has no Organization, so we treat `organizationId` and
 * `customerId` as User._id (TTT was already passing user._id under that name
 * from create-order).
 */
export const activatePlanInternal = async (req, res, next) => {
  try {
    if (!verifyInternalApiKey(extractInternalKey(req))) {
      console.warn(
        "[BILLING_ACTIVATION] Unauthorized: invalid or missing internal API key"
      );
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Invalid internal API key",
      });
    }

    const validation = validateActivationPayload(req.body);
    if (!validation.valid) {
      console.warn(`[BILLING_ACTIVATION] Invalid payload: ${validation.error}`);
      return res.status(400).json({
        success: false,
        error: "INVALID_PAYLOAD",
        message: validation.error,
      });
    }

    const {
      organizationId, // = user._id for nettwin
      customerId,
      planId,
      status,
      currentPeriodEnd,
      metadata,
    } = req.body;

    console.log(
      `[BILLING_ACTIVATION] Activating plan for user: ${organizationId}, plan: ${planId}`
    );

    const user = await User.findById(organizationId);
    if (!user) {
      console.error(`[BILLING_ACTIVATION] User not found: ${organizationId}`);
      return res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    if (isActivationIdempotent(user, { customerId, planId, status })) {
      console.log(
        `[BILLING_ACTIVATION] Duplicate activation for user ${organizationId} — returning idempotent success`
      );
      return res.json({
        success: true,
        message: "Subscription already activated (idempotent)",
        idempotent: true,
        user: {
          id: user._id,
          plan: user.plan,
          subscription: user.subscription,
        },
      });
    }

    const updatedUser = await updateLocalSubscriptionState(organizationId, {
      customerId: customerId || organizationId,
      planId,
      status, // 'paid' from TTT — normalized inside updateLocalSubscriptionState
      currentPeriodEnd,
      planSlug: metadata?.planSlug,
      metadata,
    });

    console.log(
      `[BILLING_ACTIVATION] Activated user: ${organizationId}, plan: ${updatedUser.plan?.slug}, expires: ${updatedUser.subscription?.currentPeriodEnd}`
    );

    res.json({
      success: true,
      message: "Subscription activated successfully",
      idempotent: false,
      user: {
        id: updatedUser._id,
        plan: updatedUser.plan,
        subscription: updatedUser.subscription,
      },
    });
  } catch (error) {
    console.error("[BILLING_ACTIVATION] Error activating subscription:", error);
    next(error);
  }
};

/**
 * POST /api/billing/internal/payment-failed
 * Called by TTT after a `payment.failed` webhook. We log it; the user-facing
 * UX is handled on the frontend when verify-payment returns the failure.
 */
export const handlePaymentFailedInternal = async (req, res, next) => {
  try {
    if (!verifyInternalApiKey(extractInternalKey(req))) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Invalid internal API key",
      });
    }
    const { organizationId, paymentId, reason, metadata } = req.body || {};
    console.warn(
      `[BILLING_PAYMENT_FAILED] user=${organizationId} payment=${paymentId} reason=${reason}`,
      metadata || {}
    );
    res.json({ success: true, message: "Payment failure recorded" });
  } catch (error) {
    next(error);
  }
};
