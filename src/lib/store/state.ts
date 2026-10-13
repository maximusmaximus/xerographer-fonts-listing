import type { Db } from "./types.ts";

export const STATES = [
  "CHECKOUT_OPEN", "PAID", "EXPIRED", "DEFERRED", "HELD", "RPI_CREATING", "RPI_CREATED", "CANCEL_WINDOW",
  "CANCEL_REQUESTED", "CANCELLED_REFUNDED", "PREFLIGHT_REJECTED", "RPI_REJECTED", "LOCKED", "SHIPPED",
  "REPRINT_REQUESTED", "REPRINT_APPROVED", "REPRINT_SHIPPED", "REPRINT_DECLINED", "NEEDS_ATTENTION", "DISPUTED",
] as const;
export type State = (typeof STATES)[number];

export const FINAL_STATES: ReadonlySet<State> = new Set(["EXPIRED", "CANCELLED_REFUNDED", "REPRINT_SHIPPED", "REPRINT_DECLINED"]);

const ALLOWED: Partial<Record<State, State[]>> = {
  CHECKOUT_OPEN: ["PAID", "EXPIRED"],
  PAID: ["DEFERRED", "HELD", "RPI_CREATING", "NEEDS_ATTENTION", "CANCEL_REQUESTED"],
  DEFERRED: ["RPI_CREATING", "CANCEL_REQUESTED", "HELD"],
  HELD: ["RPI_CREATING", "CANCEL_REQUESTED"],
  RPI_CREATING: ["RPI_CREATED", "NEEDS_ATTENTION", "CANCEL_REQUESTED"],
  RPI_CREATED: ["CANCEL_WINDOW", "PREFLIGHT_REJECTED", "RPI_REJECTED", "CANCEL_REQUESTED", "LOCKED", "SHIPPED", "NEEDS_ATTENTION"],
  CANCEL_WINDOW: ["CANCEL_REQUESTED", "LOCKED", "SHIPPED", "NEEDS_ATTENTION"],
  CANCEL_REQUESTED: ["CANCELLED_REFUNDED", "NEEDS_ATTENTION", "LOCKED"],
  PREFLIGHT_REJECTED: ["RPI_CREATING", "CANCELLED_REFUNDED", "CANCEL_REQUESTED", "NEEDS_ATTENTION"],
  RPI_REJECTED: ["RPI_CREATING", "CANCELLED_REFUNDED", "CANCEL_REQUESTED", "NEEDS_ATTENTION"],
  LOCKED: ["SHIPPED", "NEEDS_ATTENTION"],
  SHIPPED: ["REPRINT_REQUESTED"],
  REPRINT_REQUESTED: ["REPRINT_APPROVED", "REPRINT_DECLINED"],
  REPRINT_APPROVED: ["REPRINT_SHIPPED"],
};

export function canTransition(from: State, to: State, actor: string): boolean {
  if (from === to) return false;
  if (to === "DISPUTED") return true;
  if (from === "NEEDS_ATTENTION") return actor === "admin";
  return (ALLOWED[from] ?? []).includes(to);
}

export class TransitionError extends Error {}

/**
 * Move an order to `to` if (and only if) it is still in the state we read.
 * Compare-and-set on `state` makes concurrent webhooks/cron safe. Writes store_audit.
 * Returns false if the order moved in the meantime.
 */
export async function transition(
  db: Db,
  orderId: string,
  to: State,
  actor: string,
  note?: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const [row] = await db.query<{ state: State }>("select state from store_orders where id = $1", [orderId]);
  if (!row) throw new TransitionError("unknown order");
  if (!canTransition(row.state, to, actor)) {
    throw new TransitionError(`transition ${row.state} -> ${to} not allowed for ${actor}`);
  }
  const cols = Object.keys(extra);
  for (const c of cols) if (!/^[a-z_]+$/.test(c)) throw new TransitionError("bad column");
  const sets = cols.map((c, i) => `${c} = $${i + 4}`);
  const updated = await db.query(
    `update store_orders set state = $2, updated_at = now()${sets.length ? ", " + sets.join(", ") : ""}
     where id = $1 and state = $3 returning id`,
    [orderId, to, row.state, ...cols.map((c) => extra[c])],
  );
  if (!updated.length) return false;
  if (to === "PAID") await db.query("update store_daily_slots set expires_at = null where order_id = $1", [orderId]);
  if (to === "EXPIRED" || to === "CANCELLED_REFUNDED") await db.query("delete from store_daily_slots where order_id = $1", [orderId]);
  await audit(db, orderId, actor, note ?? null, row.state, to);
  return true;
}

export async function audit(db: Db, orderId: string | null, actor: string, note: string | null, from?: string | null, to?: string | null) {
  await db.query(
    "insert into store_audit (order_id, from_state, to_state, actor, note) values ($1, $2, $3, $4, $5)",
    [orderId, from ?? null, to ?? null, actor, note],
  );
}
