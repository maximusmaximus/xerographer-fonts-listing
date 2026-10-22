/**
 * Admin health checklist. Returns booleans, numbers and ISO timestamps only:
 * never a host, URL, key, secret, email address or env value.
 */
import type { StoreDeps } from "./types.ts";
import { BOOK } from "./rpi.ts";
import { getSetting } from "./settings.ts";

export const SECRET_NAMES = [
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID", "STRIPE_SHIPPING_RATE_STANDARD",
  "STRIPE_SHIPPING_RATE_EXPEDITED", "STRIPE_SHIPPING_RATE_RUSH", "RPI_API_AUTH", "RPI_WEBHOOK_SECRET",
  "CRON_SECRET", "ADMIN_TOKEN", "ALERT_EMAIL_TO", "RESEND_API_KEY", "DATABASE_URL", "PUBLIC_BASE_URL",
] as const;

type Get = (k: string) => string | undefined;
type Fetch = (url: string, init?: RequestInit) => Promise<{ status: number }>;

async function ok(f: () => Promise<unknown>): Promise<boolean> {
  try { await f(); return true; } catch { return false; }
}

export async function storeHealth(deps: StoreDeps, get: Get, fetcher: Fetch = fetch as unknown as Fetch) {
  const db = deps.db;
  const secretsSet = Object.fromEntries(SECRET_NAMES.map((n) => [n, Boolean(get(n)?.trim())]));
  const key = get("STRIPE_SECRET_KEY") ?? "";
  const count = async (sql: string) => Number((await db.query<{ n: string }>(sql))[0]?.n ?? 0);
  const head = (url: string) =>
    fetcher(url, { method: "HEAD", signal: AbortSignal.timeout(5000) }).then((r) => r.status === 200, () => false);
  const ping = await deps.rpi.list({ limit: 10 }).then((r) => r.kind === "ok", () => false);
  const lastCron: Record<string, string | null> = {};
  for (const job of ["reconcile", "daily-review", "post-charge"]) {
    const r = await db.query<{ t: Date | string | null }>(
      "select max(ran_at) as t from store_cron_runs where path = $1", [`/api/store/cron/${job}`]).catch(() => []);
    const t = r[0]?.t;
    lastCron[job] = t ? new Date(t).toISOString() : null;
  }
  const [interiorOk, coverOk] = await Promise.all([head(BOOK.gutsUrl), head(BOOK.coverUrl)]);
  return {
    secretsSet,
    stripeKeyIsLive: key.startsWith("sk_live_") || key.startsWith("rk_live_"),
    stripeWebhookSecretLooksValid: (get("STRIPE_WEBHOOK_SECRET") ?? "").startsWith("whsec_"),
    rpiWebhookSecretSet: Boolean(get("RPI_WEBHOOK_SECRET")),
    dbReachable: await ok(() => db.query("select 1")),
    licensesTableReadable: await ok(() => db.query("select count(*) from licenses")),
    ordersEnabled: (await getSetting(db, "ORDERS_ENABLED").catch(() => undefined)) === "true",
    killReasonSet: Boolean(await getSetting(db, "KILL_REASON").catch(() => undefined)),
    caps: { maxOrdersPerDay: deps.config.dailyOrderCap, maxExposureUsdPerDay: deps.config.dailyDollarCap },
    openNeedsAttention: await count("select count(*) as n from store_orders where state = 'NEEDS_ATTENTION'").catch(() => -1),
    heldOrders: await count("select count(*) as n from store_orders where state = 'HELD'").catch(() => -1),
    photoBytesTotal: await count("select coalesce(sum(byte_size),0) as n from store_claim_photos where purged_at is null").catch(() => 0),
    lastCron,
    rpiPingOk: Boolean(ping),
    printFilesOk: { interior: interiorOk, cover: coverOk },
  };
}
