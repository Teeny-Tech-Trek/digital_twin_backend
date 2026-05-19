#!/usr/bin/env node
/**
 * scripts/seed-nettwin-plans.js
 *
 * One-time seed script that registers NetTwin's plans in the centralized TTT
 * Payment Service via the public Plan CRUD surface. Idempotent: if a plan
 * with the same (product, slug) already exists TTT returns 409 and we move on.
 *
 * Why this lives in NetTwin (not in ttt-payment-service):
 *   The TTT Payment Service is intentionally product-agnostic — it has no
 *   knowledge of NetTwin's pricing or limits. NetTwin owns its catalog and
 *   pushes it to TTT through the same x-internal-api-key surface every other
 *   product (NexEstate, future NeoScript) uses.
 *
 * Usage:
 *   # from digital_twin_backend/
 *   node scripts/seed-nettwin-plans.js
 *
 * Required env vars (read from .env or the shell):
 *   CENTRAL_BILLING_SERVICE_URL      — TTT base URL (e.g. http://localhost:4000)
 *   CENTRAL_BILLING_INTERNAL_API_KEY — Shared secret with TTT
 *
 * NOTE: NetTwin's feature limits (twinsLimit / messagesLimit / leadsLimit)
 * are NOT sent to TTT — they live locally in src/modules/billing/billing.constants.js.
 * The plan rows in TTT only carry name, slug, price, durationDays. This keeps
 * TTT product-agnostic and lets NetTwin evolve its limits without DB migrations.
 */

import "dotenv/config";
import axios from "axios";

const BASE_URL =
  process.env.CENTRAL_BILLING_SERVICE_URL || "http://localhost:4000";
const INTERNAL_KEY =
  process.env.CENTRAL_BILLING_INTERNAL_API_KEY || "internal-dev-key-12345";
const PRODUCT = "nettwin";

// Only Pro is paid; Free is rendered locally by the NetTwin frontend (no TTT
// row needed since there's no payment flow). Seeding Free here is harmless
// but unnecessary; we skip it to keep the TTT plans table minimal.
const PLANS = [
  {
    product: PRODUCT,
    name: "Pro",
    slug: "pro",
    description: "10 digital twins, unlimited chats, 500 leads",
    price: 49900, // ₹499 in paise
    currency: "INR",
    durationDays: 30,
  },
];

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "x-internal-api-key": INTERNAL_KEY,
  },
  timeout: 10_000,
});

const run = async () => {
  console.log(`[seed-nettwin-plans] Target: ${BASE_URL}`);
  console.log(`[seed-nettwin-plans] Product: ${PRODUCT}`);
  console.log(`[seed-nettwin-plans] Seeding ${PLANS.length} plan(s)...`);

  for (const plan of PLANS) {
    try {
      const response = await client.post("/api/v1/plans", plan);
      console.log(
        `  ✓ Created '${plan.slug}' (id=${response.data?.data?.id || "?"})`
      );
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      if (status === 409) {
        console.log(`  ↳ '${plan.slug}' already exists — skipping`);
      } else {
        console.error(`  ✗ '${plan.slug}' failed: ${status} ${message}`);
        process.exitCode = 1;
      }
    }
  }

  // Quick verification — list the seeded plans back.
  try {
    const list = await client.get("/api/v1/plans", { params: { product: PRODUCT } });
    const seeded = list.data?.data?.plans || [];
    console.log(`[seed-nettwin-plans] Currently active plans for ${PRODUCT}:`);
    seeded.forEach((p) => {
      console.log(
        `  - ${p.slug.padEnd(12)} ${p.name.padEnd(16)} ₹${(p.price / 100).toFixed(0)}`
      );
    });
  } catch (error) {
    console.warn(
      `[seed-nettwin-plans] Could not list plans for verification: ${error.message}`
    );
  }
};

run().catch((error) => {
  console.error("[seed-nettwin-plans] Fatal:", error);
  process.exit(1);
});
