# NetTwin · Billing Module

NetTwin's integration with the centralized **TTT Payment Service**
(`../../../../ttt-payment-service/`). Pattern is identical to NexEstate's
billing module so adding a third product later only requires copying this
folder, swapping `TTT_PRODUCT_ID`, and re-defining `PLAN_LIMITS`.

## Flow

```
NetTwin frontend          NetTwin backend          TTT Payment Service        Razorpay
─────────────────         ─────────────────        ────────────────────       ──────────
GET  /billing/plans   →   getPlansFromCentral  →   GET  /api/v1/plans          ─
POST /billing/create-order → createOrderInCentral → POST /api/v1/payments/create-order
                                                                          →   order.create
                          ← {orderId, razorpayKey} ← {orderId, paymentId} ←  
open Razorpay popup with order_id + key
user pays …                                                                    payment.captured
                                                  ←  webhook ←─────────────────
                                                     verify signature
                                                     mark Payment paid
POST /api/billing/internal/activate-plan ← ─── productIntegrationService notifies
   ↓
   updateLocalSubscriptionState() persists user.plan + user.subscription

GET  /billing/status                       (UI refresh, shows new plan + usage bars)
```

## Files

| File | Purpose |
|---|---|
| `billing.constants.js` | env vars, `TTT_PRODUCT_ID="nettwin"`, `PLAN_LIMITS` (NetTwin-local) |
| `billing.utils.js` | error helpers, plan-limit resolution, internal-key check, idempotency |
| `billing.service.js` | axios client to TTT (create-order, payment status, get plans, sync) |
| `billing.controller.js` | public endpoints (frontend hits these) |
| `billing.routes.js` | mounts public routes under `/api/billing` |
| `billing.integration.controller.js` | TTT activation webhook handler |
| `billing.integration.routes.js` | mounts `/api/billing/internal/activate-plan` |
| `billing.middleware.js` | feature gates: `canCreateTwin`, `canSendChatMessage`, `canCreateLead` |

## Plan limits

NetTwin keeps its feature limits **locally** in `PLAN_LIMITS` — TTT's
`Plan.seats / agentsLimit / propertiesLimit` columns are intentionally NOT
used for the nettwin product. This keeps the central service product-agnostic.

| Plan | Twins | Messages/mo | Leads | Price |
|---|---|---|---|---|
| Free | 1 | 50 | 10 | ₹0 |
| Pro  | 10 | unlimited | 500 | ₹499/mo |

## Setup

1. `npm install` (adds `axios` if missing).
2. Configure these in `.env`:
   ```
   CENTRAL_BILLING_SERVICE_URL=http://localhost:4000
   CENTRAL_BILLING_INTERNAL_API_KEY=<must match TTT's INTERNAL_API_KEY>
   ```
3. Make sure TTT's `.env` has `NETTWIN_INTERNAL_URL=http://localhost:5000`
   (origin only — **no `/api` suffix**). TTT's
   `productIntegrationService.js` appends `/api/billing/internal/activate`
   itself, so a `/api` suffix here would double up.
4. Seed nettwin's paid plans into TTT once:
   ```
   npm run seed:billing
   ```
5. Set `VITE_RAZORPAY_KEY` in the frontend `.env` to the same Razorpay key
   TTT was configured with.

## Adding a tier later

1. Add the slug + limits to `PLAN_LIMITS` in `billing.constants.js`.
2. Add a row to `PLANS` in `scripts/seed-nettwin-plans.js` and re-run it.
3. The frontend picks it up automatically via `GET /api/billing/plans`.
