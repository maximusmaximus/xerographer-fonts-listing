# Specimen Ledger store — setup

The book store (Stripe Checkout → RPI print-on-demand) ships **switched off**. Until `STORE_ENV`
is set, every `/api/store/*` route answers 404 and `/book` shows "Temporarily unavailable".
Nothing in this branch changes licenses, x402, `/api/mcp`, auth, or `emailLicenseReceipt`.

Spec: `STOREFRONT-PLAN-20261012-1559PT-FINAL.md` + ADDENDUM-1 / -2 / -3.

## Environment variables (names only — set values in the host's secrets UI, never in code)

All are server-only. None may use a `VITE_` prefix.

| Name | Secret? | Test copy (sbx) | Live (prod) |
|---|---|---|---|
| `STORE_ENV` | no | `sbx` | `prod` |
| `PUBLIC_BASE_URL` | no | the test copy's URL (must NOT be fonts.grok.me) | `https://fonts.grok.me` |
| `STRIPE_SECRET_KEY` | **yes** | Stripe **test** restricted key (`rk_test_…`) | Stripe **live** restricted key (`rk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | **yes** | test endpoint signing secret | separate live endpoint signing secret |
| `STRIPE_PRICE_ID` | no | test $199 price | live $199 price |
| `STRIPE_SHIPPING_RATE_STANDARD` / `_EXPEDITED` / `_RUSH` | no | test rate ids | live rate ids |
| `RPI_BASE_URL` | no | `https://open.api.rpiprint.com` (default) | same |
| `RPI_API_AUTH` | **yes** | RPI **sandbox** key's full Authorization header value (`Basic …`) | a **new** RPI production key |
| `RPI_WEBHOOK_SECRET` | **yes** | RPI sandbox webhook secret | RPI production webhook secret |
| `CRON_SECRET` | **yes** | random; same as the Worker's `CRON_SECRET_TEST` | random; same as `CRON_SECRET_LIVE` |
| `ADMIN_TOKEN` | **yes** | random | a different random value |
| `ALERT_EMAIL_TO` | no | Max's ops inbox | same |
| `STORE_REPLY_TO` | no | `maxinfeld@gmail.com` (default) | same |
| `DAILY_ORDER_CAP` | no | optional, default `5` (set `1` to test sold-out) | optional, default `5` |
| `DAILY_DOLLAR_CAP` | no | optional, default `750` (USD of estimated RPI cost per day) | optional, default `750` |
| `STORE_EMAIL_FROM` | no | optional; falls back to `RESEND_FROM` | same |
| `RESEND_API_KEY` | **yes** | existing app key (already used by license emails) | same |
| `DATABASE_URL` | **yes** | the test copy's own Neon | live Neon |

Built-in safety checks (store stays OFF if any fail): `sbx` refuses to run on fonts.grok.me;
`prod` runs only on fonts.grok.me; `sbx` requires a Stripe test key and `prod` a live key; the
price and the three shipping-rate ids must be set.

Stripe restricted key permissions: Checkout Sessions write, Refunds write, PaymentIntents/Charges read,
Events read, Disputes and Radar early-fraud-warnings read. API version pinned in code: `2025-10-29.clover`.

## Stripe (test mode first)

1. Product "Xerographer Specimen Ledger", tax code **`txcd_35010000`** (Books — printed; checked against
   Stripe's tax-code list). One-time price **$199.00**, `tax_behavior: exclusive`.
2. Shipping rates (exclusive tax): Standard $6.99, Expedited $30.99, Rush $35.99.
3. Stripe Tax: origin address, CA registration, enable automatic tax.
4. Settings → Public details: Terms of service URL = `<PUBLIC_BASE_URL>/terms` (Checkout's required checkbox needs it).
5. Webhook endpoint `<PUBLIC_BASE_URL>/api/store/stripe/webhook` with events:
   `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `charge.refunded`,
   `charge.dispute.created`, `radar.early_fraud_warning.created`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

## RPI

- Sandbox key → `RPI_API_AUTH`; sandbox webhook secret → `RPI_WEBHOOK_SECRET`.
- The webhook URL is sent per order (`<PUBLIC_BASE_URL>/api/store/rpi/webhook?o=<order token>`); nothing to register.
- Upload the resale certificate in RPI (avoids double sales tax).

## Cloudflare Worker cron (Max's account)

POST, with headers `x-cron-timestamp` (unix seconds) and
`x-cron-signature: v1=<hex HMAC-SHA256(CRON_SECRET, "<ts>.POST.<path>")>`:

| Schedule (UTC) | Path |
|---|---|
| every 15 min | `/api/store/cron/reconcile` |
| `0 1 * * *` | `/api/store/cron/daily-review` (also purges old claim photos) |
| `15 2 * * *` | `/api/store/cron/post-charge` |

Stale (>300 s) or wrong signatures → 401; a replayed timestamp → 409; GET → 405.

## Admin

`/admin/store` — enter `ADMIN_TOKEN` (kept in the tab's sessionStorage, sent as `x-admin-token`).
Kill switch, daily caps (env `DAILY_ORDER_CAP` / `DAILY_DOLLAR_CAP`, default 5 orders / $750; copies left today = cap minus paid or reserved orders since 02:00 UTC; a checkout holds a copy for 31 minutes), Release HELD, Cancel+Refund (with "Max override"),
Approve/Decline reprint, Place replacement order (`-rp1`), claim photos, test emails, RPI ping.
Sandbox only: clock override and "drop next RPI webhook".

## Function time limit

`vite.config.ts` sets `maxDuration: 30` for `/api/store/**` via Nitro's Vercel `functionRules`
(verified in the build output: `.vercel/output/functions/api/store/[...].func/.vc-config.json`).

## Database

`migrations/0003_store.sql` and `0004_store_daily_slots.sql` add `store_*` tables only (orders, stripe/rpi event dedupe, cron replay
guard, reprint requests, claim photos in `bytea`, settings, audit). Applied by the existing
`npm run db:migrate` on deploy and automatically on PGLite in dev.

## Tests

`npm test` now includes `src/lib/store/store.test.ts` (PGLite + fakes; no network). Requires Node 22+
for `--experimental-strip-types`.

## Before launch (end-to-end in sandbox)

Follow FINAL §7 / §10.6 on the published test copy: test card 4242…, RPI Sandbox "Payment Success",
cancel before/after 4 PM PT (use the clock override), duplicate webhook resend, a 4th claim photo (409),
then switch `STORE_ENV=prod` values on live only after Max signs off.
