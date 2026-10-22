# Xerographer Fonts — project rules

## Secrets stay on the host

Production secrets for fonts.grok.me live only in the host environment. Never in git, never in a `.env` file, never in a chat reply, never in a log.

On every update:

- Do not create `.env` or commit a secret value.
- Do not delete, rename, or overwrite an existing production variable. Adding a new name is fine. Replacing a value is not, unless the owner pasted a new one in that turn.
- Read secrets from `process.env` on the server only. Never a `VITE_` prefix.

Names: `DATABASE_URL`, `X402_PAY_TO`, `X402_NETWORK`, `X402_FACILITATOR_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and the book-store names in `.env.example` (`STORE_ENV`, `PUBLIC_BASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_SHIPPING_RATE_STANDARD`, `STRIPE_SHIPPING_RATE_EXPEDITED`, `STRIPE_SHIPPING_RATE_RUSH`, `RPI_BASE_URL`, `RPI_API_AUTH`, `RPI_WEBHOOK_SECRET`, `CRON_SECRET`, `ADMIN_TOKEN`, `STORE_EMAIL_FROM`, `STORE_REPLY_TO`, `ALERT_EMAIL_TO`, `DAILY_ORDER_CAP`, `DAILY_DOLLAR_CAP`). The empty list is `.env.example`. Do not commit the admin password.
