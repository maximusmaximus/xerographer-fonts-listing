import type { StoreConfig, StoreEnv } from "./types.ts";

function numEnv(v: string | undefined, dflt: number): number {
  const n = Number(v);
  return v !== undefined && v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : dflt;
}

export const LIVE_HOST = "fonts.grok.me";

/**
 * Build the store config from env (a getter is passed in so this stays testable).
 * Returns { config: null } — store fully OFF, every store route 404s — unless all of:
 *  - STORE_ENV is "sbx" or "prod" (unset on the live site today, so merging changes nothing until Max opts in)
 *  - PUBLIC_BASE_URL is set
 *  - sbx never runs on fonts.grok.me; prod runs only on fonts.grok.me
 *  - the Stripe key mode matches (sbx: sk_test_/rk_test_, prod: sk_live_/rk_live_)
 */
export function loadStoreConfig(get: (k: string) => string | undefined): { config: StoreConfig | null; reason?: string } {
  const env = get("STORE_ENV") as StoreEnv | undefined;
  if (env !== "sbx" && env !== "prod") return { config: null, reason: "STORE_ENV not set" };
  const base = get("PUBLIC_BASE_URL")?.replace(/\/$/, "");
  if (!base) return { config: null, reason: "PUBLIC_BASE_URL not set" };
  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    return { config: null, reason: "PUBLIC_BASE_URL invalid" };
  }
  if (env === "sbx" && host === LIVE_HOST) return { config: null, reason: "sbx refused on the live host" };
  if (env === "prod" && host !== LIVE_HOST) return { config: null, reason: "prod only on the live host" };
  const key = get("STRIPE_SECRET_KEY") ?? "";
  const testKey = /^(sk|rk)_test_/.test(key);
  const liveKey = /^(sk|rk)_live_/.test(key);
  if (env === "sbx" && !testKey) return { config: null, reason: "sbx needs a Stripe test key" };
  if (env === "prod" && !liveKey) return { config: null, reason: "prod needs a Stripe live key" };
  const priceId = get("STRIPE_PRICE_ID");
  const standard = get("STRIPE_SHIPPING_RATE_STANDARD");
  const expedited = get("STRIPE_SHIPPING_RATE_EXPEDITED");
  const rush = get("STRIPE_SHIPPING_RATE_RUSH");
  if (!priceId || !standard || !expedited || !rush) return { config: null, reason: "Stripe price/shipping ids missing" };
  return {
    config: {
      env,
      publicBaseUrl: base,
      stripePriceId: priceId,
      shippingRates: { standard, expedited, rush },
      rpiBaseUrl: get("RPI_BASE_URL") ?? "https://open.api.rpiprint.com",
      replyTo: get("STORE_REPLY_TO") ?? "maxinfeld@gmail.com",
      alertTo: get("ALERT_EMAIL_TO"),
      emailFrom: get("STORE_EMAIL_FROM") ?? get("RESEND_FROM") ?? "Xerographer Fonts <licenses@xerographer.fonts>",
      dailyOrderCap: Math.floor(numEnv(get("DAILY_ORDER_CAP"), 50)),
      dailyDollarCap: numEnv(get("DAILY_DOLLAR_CAP"), 8000),
    },
  };
}
