// src/config/paymentToggle.js
//
// Single source of truth for the "are paid plan upgrades enabled?" toggle.
//
// To switch payments ON or OFF, edit ONE line in your .env file:
//
//     PAYMENTS_ENABLED=true     ← Razorpay checkout works as normal
//     PAYMENTS_ENABLED=false    ← /api/billing/create-order returns 503,
//                                  frontend shows "Contact us" modal
//
// No code changes, no rebuild — just restart the Node process so the new
// env var is picked up. (Hot-reload via nodemon picks it up automatically.)
//
// Defaults to ENABLED if the env var is unset — production must opt in
// to disabling, never opt in to enabling.
//
// Why this lives in BOTH the backend and the frontend:
//   - Backend (this file) is the security boundary. Even if a stale or
//     tampered frontend tries to call create-order, the backend refuses.
//   - Frontend has a mirror toggle for UX only — to show the right CTA
//     and avoid users clicking "Upgrade" only to see a 503 toast.
//   - Both read from environment, so flipping one env var on each service
//     keeps them in sync without any code coordination.

const raw = (process.env.PAYMENTS_ENABLED ?? "true").trim().toLowerCase();

export const PAYMENTS_ENABLED = raw !== "false" && raw !== "0" && raw !== "off" && raw !== "no";

// Where to point users when payments are disabled. Override via env if you
// want a different inbox per environment.
export const SUPPORT_CONTACT_EMAIL =
  process.env.SUPPORT_CONTACT_EMAIL || "ttt.teenytechtrek@gmail.com";

// Standardized 503 body when payments are off. Kept here so both the
// billing controller and any future endpoint that needs to block the
// flow return an identical shape.
export const paymentsDisabledResponse = (planName) => ({
  success: false,
  error: "PAYMENTS_DISABLED",
  message:
    "Online plan upgrades are currently paused. Reach out to our team and " +
    "we'll get you set up — usually within 24 hours.",
  contactEmail: SUPPORT_CONTACT_EMAIL,
  planName: planName || null,
});
