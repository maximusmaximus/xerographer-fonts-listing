/**
 * Copies left today + short reservations so two buyers can't both take the last copy.
 * Day boundary = capWindowStart (02:00 UTC), the same one the RPI exposure cap uses.
 */
import type { Db, StoreConfig } from "./types.ts";
import { capWindowStart } from "./time.ts";
import { exposureUsd } from "./settings.ts";

/** Reservation lifetime: Stripe's minimum session expiry (30 min) plus a minute of slack. */
export const RESERVATION_MS = 31 * 60_000;
const STANDARD_SHIPPING_CENTS = 699;

/** Effective copies per day: the order cap, further limited by the dollar cap at Standard shipping. */
export function dailyCopyCap(config: Pick<StoreConfig, "dailyOrderCap" | "dailyDollarCap">): number {
  const byDollars = Math.floor(config.dailyDollarCap / exposureUsd(STANDARD_SHIPPING_CENTS));
  return Math.max(0, Math.min(config.dailyOrderCap, byDollars));
}

async function dropExpired(db: Db, day: string, now: Date) {
  await db.query(
    `delete from store_daily_slots s using store_orders o
     where s.order_id = o.id and s.day = $1 and s.expires_at is not null and s.expires_at < $2 and o.state = 'CHECKOUT_OPEN'`,
    [day, now.toISOString()],
  );
}

export async function copiesLeft(db: Db, config: Pick<StoreConfig, "dailyOrderCap" | "dailyDollarCap">, now: Date) {
  const day = capWindowStart(now).toISOString();
  await dropExpired(db, day, now);
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from store_daily_slots where day = $1", [day]);
  const cap = dailyCopyCap(config);
  return { cap, taken: n, left: Math.max(0, cap - n) };
}

/** Claim a free slot for `orderId`. Returns false when sold out. Race-safe via the (day, slot) PK. */
export async function reserveSlot(db: Db, config: Pick<StoreConfig, "dailyOrderCap" | "dailyDollarCap">, orderId: string, now: Date): Promise<boolean> {
  const day = capWindowStart(now).toISOString();
  const cap = dailyCopyCap(config);
  await dropExpired(db, day, now);
  for (let attempt = 0; attempt < cap + 1; attempt += 1) {
    const rows = await db.query(
      `insert into store_daily_slots (day, slot, order_id, expires_at)
       select $1, s, $2, $3 from generate_series(1, $4::int) s
       where not exists (select 1 from store_daily_slots d where d.day = $1 and d.slot = s)
       order by s limit 1
       on conflict do nothing returning slot`,
      [day, orderId, new Date(now.getTime() + RESERVATION_MS).toISOString(), cap],
    );
    if (rows.length) return true;
    const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from store_daily_slots where day = $1", [day]);
    if (n >= cap) return false; // genuinely full; otherwise we lost a race for one slot, try the next
  }
  return false;
}

/** Paid: the slot becomes permanent. */
export const confirmSlot = (db: Db, orderId: string) =>
  db.query("update store_daily_slots set expires_at = null where order_id = $1", [orderId]);

/** Expired checkout or full refund: the copy goes back on sale. */
export const releaseSlot = (db: Db, orderId: string) => db.query("delete from store_daily_slots where order_id = $1", [orderId]);
