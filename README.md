# Xerographer Fonts

Live site: [fonts.grok.me](https://fonts.grok.me)

Catalog, live type tester, MCP service, and x402 commercial licensing for 1,376 original typefaces by [Max Infeld](https://maxi.grok.me).

| | |
| --- | --- |
| This repository | The website |
| [maximusmaximus/xerographer-fonts](https://github.com/maximusmaximus/xerographer-fonts) | The font files |
| Personal use | Donationware, from DaFont and the font repository |
| One face, commercial | US$95 USDC per font, per agent |
| Whole catalog, commercial | US$65,000 USDC, one agent |

Copyright © Max Infeld. Licensing questions: maxinfeld@gmail.com.

## For people

- Browse the catalog, or filter by category.
- Type your own words to try a face.
- Dark by default. The header switches to light.
- About the designer: [maxi.grok.me](https://maxi.grok.me) and [curio.cards](https://curio.cards).

## For agents

MCP: `/api/mcp`. Discovery: `/.well-known/mcp.json` and `/llms.txt`.

| Tool | What it does |
| --- | --- |
| `list_fonts` | Search, category, sort, pagination |
| `get_font` | Metadata and listing links |
| `list_categories` | Category tree |
| `preview_text` | A live preview URL |
| `purchase_commercial_license` | x402, US$95, one face. Optional `email` |
| `purchase_catalog_license` | x402, US$65,000, every face, one agent |
| `get_license` | Receipt and PDF |

A purchase answers **402** with a `PAYMENT-REQUIRED` header (USDC on Base). Retry with `PAYMENT-SIGNATURE`. Success returns `PAYMENT-RESPONSE` and the grant. The PDF is always at `/api/licenses/:id/pdf`. If you pass `email`, a copy goes there, and maxinfeld@gmail.com always gets one, once email is configured below.

## Secrets

Production secrets are environment variables on the host that runs [fonts.grok.me](https://fonts.grok.me). They are not in this repository, and a code update must not delete or replace them.

| Name | Required | Used for |
| --- | --- | --- |
| `DATABASE_URL` | Yes. The host injects it. | Postgres for license records |
| `X402_PAY_TO` | Yes, or payments have nowhere to go | USDC address that receives license payments |
| `X402_NETWORK` | No. Default `base` | `base` or `base-sepolia` |
| `X402_FACILITATOR_URL` | No | Default `https://x402.org/facilitator` |
| `RESEND_API_KEY` | No | Sends the license PDF by email |
| `RESEND_FROM` | No | From-address. Default `Xerographer Fonts <licenses@xerographer.fonts>` |

Rules for every update:

1. Never commit a secret value. `.env`, `.env.*` except `.env.example`, and `.secrets/` stay ignored.
2. Never delete, rename, or overwrite an existing production variable when shipping code. Add a new name if the app needs one. Leave the current value alone.
3. Server code reads `process.env` only. Never put a secret behind a `VITE_` prefix. That would ship it to the browser.

Empty names, and nothing else, are in [`.env.example`](.env.example).

## Run it

```bash
npm install
npm run dev
```

The catalog runs with no secrets. License payments need `X402_PAY_TO`. Receipt email needs `RESEND_API_KEY`.

## The grant

A paid license is unlimited commercial use of that typeface, or of the whole catalog if that is what was bought. The licensee may use and embed the fonts in their own work. They may not resell, redistribute, or sublicense the font files, and they may not modify the typefaces or make derivative fonts without written permission from Max Infeld / Xerographer Fonts. One payment is one licensee.
