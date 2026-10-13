import type { Db, StoreDeps } from "./types.ts";
import { capWindowStart } from "./time.ts";
import { audit } from "./state.ts";
import { sendAlert } from "./emails.ts";

export async function getSetting(db: Db, key: string): Promise<string | undefined> {
  const [r] = await db.query<{ value: string }>("select value from store_settings where key = $1", [key]);
  return r?.value;
}

export async function setSetting(db: Db, key: string, value: string) {
  await db.query(
    "insert into store_settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value",
    [key, value],
  );
}

export async function storeGuard(db: Db): Promise<{ open: boolean; reason?: string }> {
  const v = await getSetting(db, "ORDERS_ENABLED");
  return v === "true" ? { open: true } : { open: false, reason: "orders disabled (kill switch)" };
}

/** Estimated RPI charge per order: 102.60 + shipping, plus 10% for tax/variance. */
export function exposureUsd(shippingCents: number): number {
  const base = 102.6 + shippingCents / 100;
  return Math.round(base * 1.1 * 100) / 100;
}

export async function capCheck(db: Db, now: Date, nextShippingCents: number) {
  const since = capWindowStart(now);
  const rows = await db.query<{ amount_shipping_cents: number | null }>(
    "select amount_shipping_cents from store_orders where rpi_first_sent_at >= $1",
    [since.toISOString()],
  );
  const maxOrders = Number((await getSetting(db, "MAX_RPI_ORDERS_PER_DAY")) ?? 5);
  const maxUsd = Number((await getSetting(db, "MAX_RPI_EXPOSURE_USD_PER_DAY")) ?? 750);
  const count = rows.length;
  const exposure = rows.reduce((s, r) => s + exposureUsd(r.amount_shipping_cents ?? 0), 0);
  const next = exposure + exposureUsd(nextShippingCents);
  const ok = count < maxOrders && next <= maxUsd;
  return { ok, count, exposure: Math.round(exposure * 100) / 100, maxOrders, maxUsd };
}

export async function tripKillSwitch(deps: StoreDeps, reason: string) {
  await setSetting(deps.db, "ORDERS_ENABLED", "false");
  await audit(deps.db, null, "system", `kill switch: ${reason}`);
  await sendAlert(deps, "Store kill switch tripped", `Orders are now disabled. Reason: ${reason}`);
}
