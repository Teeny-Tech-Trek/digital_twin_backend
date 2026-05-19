// src/modules/billing/billing.integration.routes.js
// Internal endpoints — TTT Payment Service calls these. Authenticated via
// the shared `x-internal-api-key` header (checked inside each handler).

import express from "express";
import * as integrationController from "./billing.integration.controller.js";

const router = express.Router();

// TTT's productIntegrationService.notifyProductPaymentSuccess targets the
// literal path `${NETTWIN_INTERNAL_URL}/api/billing/internal/activate`
// (see ttt-payment-service/src/services/productIntegrationService.js, the
// `endpoint = ${baseUrl}/api/billing/internal/activate` line). Mounting this
// router at `/api/billing` with NETTWIN_INTERNAL_URL pointed at the NetTwin
// origin (e.g. http://localhost:5000) makes the URL line up exactly.
//
// `/internal/activate-plan` is kept as a forward-compatible alias for the
// path style NexEstate's docs reference, so future TTT versions that adopt
// the more explicit name keep working without a NetTwin redeploy.
router.post("/internal/activate", integrationController.activatePlanInternal);
router.post("/internal/activate-plan", integrationController.activatePlanInternal);
router.post(
  "/internal/payment-failed",
  integrationController.handlePaymentFailedInternal
);

export default router;
