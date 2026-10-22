/**
 * Limited edition of 500. A copy number is reserved at checkout (same lifetime as the Stripe
 * session), made permanent when paid, and released on expiry / cancel / refund.
 * Race-safe via the copy_no primary key.
 */
import type { Db } from "./types.ts";
import { RESERVATION_MS } from "./slots.ts";

export const EDITION_SIZE = 500;

async function dropExpired(db: Db, now: Date) {
  await db.query(
    `delete from store_edition_copies c using store_orders o
     where c.order_id = o.id and c.expires_at is not null and c.expires_at < $1 and o.state in ('CHECKOUT_OPEN','EXPIRED')`,
    [now.toISOString()],
  );
}

export async function editionStatus(db: Db, now: Date) {
  await dropExpired(db, now);
  const [r] = await db.query<{ sold: number; held: number }>(
    "select count(*) filter (where expires_at is null)::int as sold, count(*) filter (where expires_at is not null)::int as held from store_edition_copies",
  );
  const taken = r.sold + r.held;
  return { size: EDITION_SIZE, sold: r.sold, reserved: r.held, left: Math.max(0, EDITION_SIZE - taken), soldOut: taken >= EDITION_SIZE };
}

/** Lowest free copy number for `orderId`, or null when all 500 are taken. */
export async function reserveCopy(db: Db, orderId: string, now: Date): Promise<number | null> {
  await dropExpired(db, now);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rows = await db.query<{ copy_no: number }>(
      `insert into store_edition_copies (copy_no, order_id, expires_at)
       select s, $1, $2 from generate_series(1, $3::int) s
       where not exists (select 1 from store_edition_copies c where c.copy_no = s)
       order by s limit 1
       on conflict do nothing returning copy_no`,
      [orderId, new Date(now.getTime() + RESERVATION_MS).toISOString(), EDITION_SIZE],
    );
    if (rows.length) return rows[0].copy_no;
    const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from store_edition_copies");
    if (n >= EDITION_SIZE) return null;
  }
  return null;
}

export const releaseCopy = (db: Db, orderId: string) => db.query("delete from store_edition_copies where order_id = $1", [orderId]);
