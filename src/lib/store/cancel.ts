import type { StoreDeps } from "./types.ts";
import { transition } from "./state.ts";
import { refundInFull } from "./refunds.ts";
import { rpiStatusOf } from "./rpi.ts";
import { sendAlert, sendCancelledRefunded, type OrderRow } from "./emails.ts";

export const CUSTOMER_CANCELLABLE = new Set([
  "PAID", "DEFERRED", "HELD", "RPI_CREATING", "RPI_CREATED", "CANCEL_WINDOW", "PREFLIGHT_REJECTED", "RPI_REJECTED",
]);

export const GONE_TO_PRINT =
  "This order has gone to print and can't be cancelled or refunded. If your copy arrives misprinted or damaged, report it here within 14 days of delivery for a free replacement.";

export async function isCustomerCancellable(deps: StoreDeps, order: OrderRow): Promise<boolean> {
  if (!CUSTOMER_CANCELLABLE.has(order.state) || !order.cancel_deadline_utc) return false;
  return (await deps.now()).getTime() < new Date(order.cancel_deadline_utc).getTime();
}

/** Customer (or admin) cancel. Admin may skip the deadline, never LOCKED unless `maxOverride`. */
export async function requestCancel(
  deps: StoreDeps,
  order: OrderRow,
  actor: "customer" | "admin",
  opts: { maxOverride?: boolean } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (actor === "customer") {
    if (!(await isCustomerCancellable(deps, order))) return { status: 409, body: { error: GONE_TO_PRINT } };
  } else if (!CUSTOMER_CANCELLABLE.has(order.state) && !(opts.maxOverride && ["LOCKED", "NEEDS_ATTENTION", "CANCEL_REQUESTED"].includes(order.state))) {
    return { status: 409, body: { error: `not cancellable from ${order.state}` } };
  }
  const now = (await deps.now()).toISOString();
  if (order.state !== "CANCEL_REQUESTED") {
    const from = order.state;
    let ok: boolean;
    if (from === "LOCKED" || from === "NEEDS_ATTENTION") {
      ok = await transition(deps.db, order.id, "NEEDS_ATTENTION", "admin", "Max override cancel").catch(() => false);
      ok = await transition(deps.db, order.id, "CANCEL_REQUESTED", "admin", "Max override cancel", { cancel_requested_at: now });
    } else {
      ok = await transition(deps.db, order.id, "CANCEL_REQUESTED", actor, "cancel requested", { cancel_requested_at: now });
    }
    if (!ok) return { status: 409, body: { error: "order changed, try again" } };
  }
  const result = await processCancel(deps, order.id, actor);
  return { status: 200, body: { result } };
}

/** Drive a CANCEL_REQUESTED order forward. Safe to call repeatedly (reconcile does). */
export async function processCancel(deps: StoreDeps, orderId: string, actor: string): Promise<string> {
  const [order] = await deps.db.query<OrderRow>("select * from store_orders where id = $1", [orderId]);
  if (!order || order.state !== "CANCEL_REQUESTED") return "noop";
  if (order.customer_order_id) {
    const res = await deps.rpi.cancel(order.customer_order_id);
    let rpiStatus: string | undefined;
    if (res.kind === "ok") rpiStatus = rpiStatusOf(res.body) ?? "CANCELLED";
    else if (res.kind === "http" && res.status === 404) rpiStatus = "NOT_FOUND"; // never created there
    else if (res.kind === "http" && res.status === 400 && /validat/i.test(String(res.errorDescription ?? ""))) return "retry_later";
    else if (res.kind === "http" && res.status === 400) {
      // Maybe already cancelled: check.
      const g = await deps.rpi.get(order.customer_order_id);
      if (g.kind === "ok" && rpiStatusOf(g.body) === "VALIDATING") return "retry_later";
      rpiStatus = g.kind === "ok" ? rpiStatusOf(g.body) : undefined;
    } else return "retry_later";
    await deps.db.query("update store_orders set rpi_status = $2 where id = $1", [orderId, rpiStatus ?? null]);
    if (rpiStatus !== "CANCELLED" && rpiStatus !== "NOT_FOUND") {
      await transition(deps.db, orderId, "NEEDS_ATTENTION", actor, `RPI cancel returned ${rpiStatus ?? "unknown"}`);
      await sendAlert(deps, "Cancel needs attention", `Order ${orderId.slice(0, 8)}: customer cancelled before the deadline but RPI reports ${rpiStatus ?? "unknown"}. Honor the refund per the terms.`);
      return "needs_attention";
    }
  }
  let amount: number;
  try {
    amount = await refundInFull(deps, order);
  } catch {
    await transition(deps.db, orderId, "NEEDS_ATTENTION", actor, "refund failed", { last_error: "stripe refund failed" });
    await sendAlert(deps, "Refund failed", `Order ${orderId.slice(0, 8)}: RPI cancelled but the Stripe refund failed. Refund manually.`);
    return "refund_failed";
  }
  await transition(deps.db, orderId, "CANCELLED_REFUNDED", actor, `refunded ${amount}`);
  await sendCancelledRefunded(deps, order, amount);
  return "cancelled_refunded";
}
