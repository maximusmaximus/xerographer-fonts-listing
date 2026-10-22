# Grok Build prompt: set up the Specimen Ledger store on the TEST copy

Paste everything inside the box into the Grok Build **test copy** project, not the live fonts.grok.me project.

```
STORE TEST SETUP (sandbox). Never print, log or echo any secret value, in chat or in code.

STEP 0 — SAFETY STOP.
Tell me this project's name and its published URL (or "unpublished").
If the published URL is fonts.grok.me (the live site), STOP now and change nothing, unless I reply
with exactly "THIS IS THE TEST COPY". Don't go on to step 1 until you've told me the name and URL.

STEP 1 — SYNC THE CODE.
Bring in the GitHub branch "store-rpi-stripe" from the repository maximusmaximus/xerographer-fonts-listing.
Merge it into this project and keep everything this project already has; the branch only adds the
store. If anything conflicts, keep this project's version of existing site files (catalog, studio,
licenses, x402, /api/mcp, auth, src/lib/email.ts) and take the branch's version of the new store files
(src/lib/store/*, src/routes/api/store/*, src/routes/book.tsx, src/routes/book_.thanks.tsx,
src/routes/terms.tsx, src/routes/order.$token.tsx, src/routes/admin.store.tsx, src/lib/store-status.ts,
migrations/0003_store.sql, migrations/0004_store_daily_slots.sql, STORE-SETUP.md). Install dependencies
(the branch adds the "stripe" package). Show me the list of files that changed, and any conflicts and
how you resolved them.

STEP 2 — DATABASE.
Run the database migrations so that migrations/0003_store.sql and migrations/0004_store_daily_slots.sql
are applied to THIS project's own database (not the live site's). Tell me the store_ tables that now
exist. Don't change or drop any existing table (for example licenses).

STEP 3 — CHECK SECRETS AND SETTINGS (names only).
For each name below, tell me only "set" or "NOT SET". Never show a value.
  STORE_ENV, PUBLIC_BASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID,
  STRIPE_SHIPPING_RATE_STANDARD, STRIPE_SHIPPING_RATE_EXPEDITED, STRIPE_SHIPPING_RATE_RUSH,
  RPI_BASE_URL (optional), RPI_API_AUTH, RPI_WEBHOOK_SECRET, CRON_SECRET, ADMIN_TOKEN,
  ALERT_EMAIL_TO, STORE_REPLY_TO (optional), STORE_EMAIL_FROM (optional), DAILY_ORDER_CAP (optional),
  DAILY_DOLLAR_CAP (optional), RESEND_API_KEY, DATABASE_URL.
Also confirm, without showing them, that:
  - STRIPE_SECRET_KEY is a TEST key (it starts with sk_test_ or rk_test_);
  - PUBLIC_BASE_URL is this test copy's published URL and is NOT fonts.grok.me.
None of these may have a VITE_ prefix.

STEP 4 — STORE_ENV.
Set STORE_ENV to sbx in THIS project's secrets/settings. (The store refuses to run in sbx on
fonts.grok.me, and it stays off if the Stripe key isn't a test key.)

STEP 5 — PUBLISH AND REPORT.
Publish this project with access "Anyone with the link". Then tell me:
  a) the published URL;
  b) that the header shows a "Buy Our Specimen Book" tab, and that it links to /book;
  c) that /book shows the "copies left today" line (for example "5 of 5 copies left today") and an
     enabled Buy button;
  d) what <published URL>/api/store/status returns (it should include "enabled":true).
If the tab or the count doesn't appear, open <published URL>/api/store/status and tell me what it
returns. Don't change any code to force it.
```

---

# Test walkthrough (Stripe test mode + RPI sandbox, on the test copy only)

Call the test copy's address **TEST** (for example `https://something.grok.me`). Nothing here charges a real card or prints a real book.

1. **Stripe webhook.** In Stripe, switch to **Test mode** and go to Developers → Webhooks → Add endpoint. Use the URL **`TEST/api/store/stripe/webhook`** and select these events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`, `radar.early_fraud_warning.created`. Copy the endpoint's signing secret into the test copy's `STRIPE_WEBHOOK_SECRET`, then republish. Also set Settings → Public details → Terms of service URL to `TEST/terms`.
2. **RPI sandbox.** Make sure `RPI_API_AUTH` and `RPI_WEBHOOK_SECRET` are the **sandbox** values from the RPI dashboard (Developer Tools → API Keys, Sandbox mode). Open `TEST/admin/store`, enter your admin token, and click **RPI ping**. It should show HTTP 200.
3. **Buy a book.** Open TEST and click **Buy Our Specimen Book**. The page should say "5 of 5 copies left today". Click Buy, then pay with card **4242 4242 4242 4242**, any future expiry date, any 3-digit CVC, and a California address (Alaska and Hawaii addresses are refused and refunded automatically). You'll land on the thanks page, and the confirmation email should arrive.
4. **Check it reached the printer.** In the RPI dashboard (Sandbox → Orders), a new order starting `xsl-sbx-` appears within a minute. `/admin/store` shows the order moving to RPI_CREATED, then CANCEL_WINDOW. `/book` now shows 4 copies left.
5. **Cancel before 4 PM PT.** Before 4:00 PM Pacific, open the order link from the confirmation email and click **Cancel order for a full refund**. Expect: the RPI sandbox order shows CANCELLED, Stripe test mode shows a full refund, the "cancelled" email arrives, and the copy goes back on sale. If it's already after 4 PM, use **Set clock** in `/admin/store` (sandbox only) to pretend it's earlier, and click **Clear clock** afterwards.
6. **Locked after printing starts.** Buy a second test copy. In the RPI sandbox, use Test Order Payments → **Payment Success** on it. The order moves to LOCKED, and its cancel button disappears.
7. **Sold-out check.** Set `DAILY_ORDER_CAP=1` in the test copy's settings and republish. Once a copy has been bought today (or a checkout is open), `/book` shows **"Sold out for today, back tomorrow"** and the Buy button is greyed out. Clicking Buy from a second browser is refused. Afterwards, delete `DAILY_ORDER_CAP` (or set it back to 5) and republish. The count resets daily at 02:00 UTC (7 PM PDT).
8. **Duplicate webhook.** In Stripe → Developers → Webhooks → your endpoint, open the `checkout.session.completed` event from step 3 and click **Resend** two or three times. Each resend shows 200, but still only **one** RPI sandbox order exists and no second confirmation email arrives.
9. **Clean up.** Clear any clock override. If you want orders off between tests, turn them off in `/admin/store`. Don't add `STORE_ENV` or any store keys to the live fonts.grok.me project until we decide to launch.
