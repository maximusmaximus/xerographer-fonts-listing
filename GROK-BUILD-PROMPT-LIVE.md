# Grok Build prompt: turn the Specimen Ledger store ON at fonts.grok.me (LIVE)

Paste everything inside the box into the **live fonts.grok.me** project. Don't publish between
**6:00 and 7:15 PM PT** (RPI charges its card at 02:00 UTC, which is 7 PM PDT).

```
LIVE STORE LAUNCH — fonts.grok.me. This is the LIVE project and it takes real money.
Never print, log or echo any secret value, in chat or in code. Don't change any existing site
behavior (catalog, studio, font pages, licenses, x402, /api/mcp, /.well-known/mcp.json, auth,
src/lib/email.ts and emailLicenseReceipt).

STEP 0 — CONFIRM PROJECT.
Tell me this project's name and its published URL. If the published URL is NOT fonts.grok.me,
STOP and change nothing.

STEP 1 — SYNC THE CODE.
Bring in the GitHub branch "store-rpi-stripe" from the repository maximusmaximus/xerographer-fonts-listing
and merge it into this project. On any conflict, KEEP THIS PROJECT'S VERSION of existing site files, and
take the branch's version only of the new store files (src/lib/store/*, src/routes/api/store/*,
src/routes/book.tsx, src/routes/book_.thanks.tsx, src/routes/terms.tsx, src/routes/order.$token.tsx,
src/routes/admin.store.tsx, src/lib/store-status.ts, migrations/0003_store.sql,
migrations/0004_store_daily_slots.sql, STORE-SETUP.md). The branch also adds the "Buy Our Specimen
Book" tab to src/components/layout.tsx, the stripe dependency and the store test in package.json, and
the store function time limit in vite.config.ts. Keep those additions alongside this project's code.
Install dependencies, including the "stripe" npm package. Show me every changed file, plus each
conflict and how you resolved it. Do NOT publish yet.

STEP 2 — DATABASE (live).
Apply migrations/0003_store.sql and migrations/0004_store_daily_slots.sql to this project's database.
They only CREATE store_* tables and seed store_settings. Don't alter, drop or write to licenses,
_migrations history for other files, or any non-store table. Tell me the store_ tables that now exist,
and confirm that the licenses table's row count is unchanged (show the before and after counts only).

STEP 3 — CHECK SETTINGS (names only, never values).
Report each as "set" or "NOT SET":
  REQUIRED: PUBLIC_BASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID,
            STRIPE_SHIPPING_RATE_STANDARD, STRIPE_SHIPPING_RATE_EXPEDITED, STRIPE_SHIPPING_RATE_RUSH,
            RPI_API_AUTH, RPI_WEBHOOK_SECRET, CRON_SECRET, ADMIN_TOKEN, ALERT_EMAIL_TO,
            RESEND_API_KEY, DATABASE_URL
  OPTIONAL: RPI_BASE_URL, STORE_REPLY_TO, STORE_EMAIL_FROM, DAILY_ORDER_CAP, DAILY_DOLLAR_CAP
Also confirm, without showing values, that:
  - STRIPE_SECRET_KEY starts with sk_live_ or rk_live_ (a LIVE key);
  - PUBLIC_BASE_URL is exactly https://fonts.grok.me;
  - RPI_API_AUTH is the PRODUCTION key (not a sandbox key), if you can tell from the setting's label;
  - DAILY_ORDER_CAP is NOT set (so the cap defaults to 5 copies a day);
  - no store setting has a VITE_ prefix.

STEP 4 — STOP CHECK.
If ANY required setting is NOT SET, or the Stripe key isn't a live key, or PUBLIC_BASE_URL isn't
exactly https://fonts.grok.me, STOP HERE. Don't set STORE_ENV and don't publish. Tell me what's missing.

STEP 5 — TURN IT ON.
Only if step 4 passed: set STORE_ENV = prod. Leave DAILY_ORDER_CAP unset.

STEP 6 — PUBLISH AND REPORT.
Publish. Then tell me:
  a) the published URL (must be fonts.grok.me);
  b) that the header shows the "Buy Our Specimen Book" tab, and that it links to /book;
  c) that /book shows "5 of 5 copies left today" (or the current count) and an enabled Buy button;
  d) the exact JSON from https://fonts.grok.me/api/store/status (it must include "enabled":true);
  e) that the homepage, a font page, /api/mcp and /.well-known/mcp.json still load as before.
Do NOT click Buy or create any checkout yourself.
If "enabled" is false, set STORE_ENV back to empty, republish, and tell me. Don't change code to force it.
```

---

# Live launch checklist (Max, in the Stripe LIVE dashboard and Cloudflare)

Do steps 1–5 **before** pasting the prompt (the prompt stops if they're missing).

1. **Product and price (Stripe LIVE).** Create the product "Xerographer Specimen Ledger" with tax code **`txcd_35010000`** (Books, printed). Add a one-time price of **$250.00 USD** with tax behavior **exclusive**. Put the price id (`price_…`) in `STRIPE_PRICE_ID`.
2. **Shipping rates.** Create three fixed rates, all with tax behavior exclusive: **Standard $6.99**, **Expedited $30.99**, **Rush $35.99**. Put their ids (`shr_…`) in `STRIPE_SHIPPING_RATE_STANDARD`, `STRIPE_SHIPPING_RATE_EXPEDITED` and `STRIPE_SHIPPING_RATE_RUSH`.
3. **Stripe Tax.** Under Tax, set the origin address, add your CA registration, and turn on automatic tax.
4. **Terms URL.** Under Settings → Public details, set the Terms of service URL to **`https://fonts.grok.me/terms`**. Checkout's required checkbox won't work without it.
5. **Live webhook.** Under Developers → Webhooks → Add endpoint, use **`https://fonts.grok.me/api/store/stripe/webhook`** with these 6 events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`, `radar.early_fraud_warning.created`. Put its **signing secret** (`whsec_…`) in `STRIPE_WEBHOOK_SECRET`. Make sure it's the LIVE endpoint's secret, not a test-mode one.
6. **RPI.** `RPI_API_AUTH` must be a new **production** key, not the key pasted in chat (rotate that one), and `RPI_WEBHOOK_SECRET` must be the production webhook secret. Upload your resale certificate to RPI to avoid paying sales tax twice.
7. **Admin and alerts.** Set `ADMIN_TOKEN` to a long random value, and `ALERT_EMAIL_TO` to your inbox. Confirm `RESEND_API_KEY` is set.
8. **Timing.** Don't publish between **6:00 and 7:15 PM PT** (RPI's nightly charge is at 7 PM PDT). It's 6:52 PM PT now, which is inside that window, so wait until after 7:15 PM PT.
9. **Cloudflare cron.** Set `CRON_SECRET` to a long random value, and give the Worker the same value as an encrypted secret. Schedules (UTC), each a signed POST (see STORE-SETUP.md):
   - every 15 minutes: `https://fonts.grok.me/api/store/cron/reconcile`
   - `0 1 * * *`: `https://fonts.grok.me/api/store/cron/daily-review`
   - `15 2 * * *`: `https://fonts.grok.me/api/store/cron/post-charge`

   Until the cron runs, orders paid after 4 PM PT wait in DEFERRED and aren't sent to the printer, so set it up the same day.
10. **After publishing.** Open `/admin/store` with your admin token and click **RPI ping** (expect 200). Optionally buy one copy yourself and cancel it before 4 PM PT for a full refund; Stripe keeps its fee. Kill switch: "Turn orders OFF" on `/admin/store`, or set `STORE_ENV` empty and republish.
