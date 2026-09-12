# Xerographer Fonts listing

Catalog, live type tester, MCP service, and x402 commercial licensing for [Xerographer Fonts](https://www.dafont.com/max-infeld.d3584) by [Max Infeld](https://maxi.grok.me).

1,376 original typefaces, pulled from DaFont. Personal use remains donationware. Unlimited commercial use is **US$45 USDC per font per agent**, settled with [x402](https://www.x402.org).

Download counts are aggregated from DaFont, FontSpace, and WebFontFree. Every face links to FFonts, Fonts2u, FontGet, WhatFontIs, and 1001 Free Fonts, plus FontSpace, BlogFonts, and Hey Fonts where listed.

## Humans

- Scroll the catalog or filter by DaFont category
- Type custom text to proof faces (live `@font-face` from the DaFont zip, with specimen fallback)
- Dark mode by default; toggle in the header
- About: designer bio, [maxi.grok.me](https://maxi.grok.me), [curio.cards](https://curio.cards)

## Agents

MCP at `/api/mcp`. Discovery at `/.well-known/mcp.json` and `/llms.txt`.

| Tool | Notes |
| --- | --- |
| `list_fonts` | Search, category, sort, pagination |
| `get_font` | Metadata + DaFont / download / designer links |
| `list_categories` | Theme tree |
| `preview_text` | Live TTF URL + specimen |
| `purchase_commercial_license` | x402, US$45, optional `email` |
| `get_license` | Receipt + PDF |

`purchase_commercial_license` answers **402 Payment Required** with a `PAYMENT-REQUIRED` header (exact USDC on Base). Retry with `PAYMENT-SIGNATURE`. Success returns `PAYMENT-RESPONSE` containing the grant: the licensee may use that typeface commercially without further royalty.

Optional `email` receives the PDF certificate. **maxinfeld@gmail.com always gets a copy.** Set `RESEND_API_KEY` (and optionally `RESEND_FROM`) so those messages actually send. The PDF is always available at `/api/licenses/:id/pdf`.

Configure `X402_PAY_TO` (USDC address), optional `X402_NETWORK` (`base` or `base-sepolia`), and `X402_FACILITATOR_URL`.

## License grant (plain language)

After a successful x402 payment, the payer is granted **unlimited commercial use** of the named typeface. Sources stay on DaFont. One payment = one font = one agent/wallet.
