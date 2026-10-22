# Xerographer Fonts — project rules

## Secrets stay on the host

Production secrets for fonts.grok.me live only in the host environment. Never in git, never in a `.env` file, never in a chat reply, never in a log.

On every update:

- Do not create `.env` or commit a secret value.
- Do not delete, rename, or overwrite an existing production variable. Adding a new name is fine. Replacing a value is not, unless the owner pasted a new one in that turn.
- Read secrets from `process.env` on the server only. Never a `VITE_` prefix.

Names: `DATABASE_URL`, `X402_PAY_TO`, `X402_NETWORK`, `X402_FACILITATOR_URL`, `RESEND_API_KEY`, `RESEND_FROM`. The empty list is `.env.example`.
