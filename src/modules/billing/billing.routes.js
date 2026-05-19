// src/modules/billing/billing.routes.js
// Public billing routes (frontend → backend).

import express from "express";
import { protect } from "../../middleware/authMiddleware.js";
import * as billingController from "./billing.controller.js";

const router = express.Router();

// Listing plans is public so a logged-out pricing page can render. All other
// endpoints require an authenticated user.
router.get("/plans", billingController.getPlans);

router.get("/status", protect, billingController.getBillingStatus);
router.post("/initialize", protect, billingController.initializeBilling);
router.post("/create-order", protect, billingController.createOrder);
router.post("/verify-payment", protect, billingController.verifyPayment);
router.post("/sync-subscription", protect, billingController.syncSubscription);
router.get("/invoices", protect, billingController.getInvoices);
router.get("/customer-info", protect, billingController.getCustomerInfo);

export default router;
