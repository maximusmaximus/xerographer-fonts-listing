import type { StoreDeps } from "./types.ts";
import { sha256Hex } from "./ids.ts";
import { applyRpiStatus } from "./rpi.ts";
import { audit, canTransition, transition } from "./state.ts";
import { sendAlert, type OrderRow } from "./emails.ts";
import { getSetting, setSetting } from "./settings.ts";

/** Called only after the HMAC check passed. Treats the webhook as a hint and re-GETs. */
export async function handleRpiWebhook(deps: StoreDeps, raw: string, orderToken: string | null): Promise<string> {
  const hash = sha256Hex(raw);
  let body: any = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return "bad_json";
  }
  const source = String(body?.source ?? "");
  const coid = body?.data?.customerOrderId ?? body?.data?.order?.customerOrderId ?? null;
  const fresh = await deps.db.query(
    "insert into store_rpi_events (body_sha256, customer_order_id, source) values ($1, $2, $3) on conflict do nothing returning body_sha256",
    [hash, coid, source],
  );
  if (!fresh.length) return "duplicate";
  if (deps.config.env === "sbx" && (await getSetting(deps.db, "SBX_DROP_NEXT_RPI_WEBHOOK")) === "true") {
    await setSetting(deps.db, "SBX_DROP_NEXT_RPI_WEBHOOK", "false");
    return "dropped (sbx self-test)";
  }
  let order: OrderRow | undefined;
  if (orderToken) [order] = await deps.db.query<OrderRow>("select * from store_orders where id = $1", [orderToken]);
  if (!order && coid) [order] = await deps.db.query<OrderRow>("select * from store_orders where customer_order_id = $1", [coid]);
  if (!order) return "unknown_order";
  // The token in ?o= must match the RPI id in the body, if the body names one.
  if (coid && order.customer_order_id && coid !== order.customer_order_id && !String(coid).startsWith(order.customer_order_id)) {
    return "mismatch";
  }
  await audit(deps.db, order.id, "rpi", `webhook ${source}`);
  if (source === "PaymentFailure") await sendAlert(deps, "RPI card payment failed", `RPI could not charge your card for order ${order.id.slice(0, 8)}. RPI retries the next day.`);
  if (source === "OrderReprintRequested") return "noted";
  // RPI order-limit queue (parity with the emoji store).
  if (source === "OrderOverLimitQueued") {
    await sendAlert(deps, "RPI limit queue", `Order ${order.id.slice(0, 8)} is waiting in RPI's order-limit queue.`);
  }
  if (source === "OrderExceedsLimitQueue") {
    await sendAlert(deps, "RPI rejected an order: limit queue full", `Order ${order.id.slice(0, 8)} was not accepted by RPI (limit queue full). Not resubmitted.`);
    if (canTransition(order.state as Parameters<typeof canTransition>[0], "NEEDS_ATTENTION", "rpi")) await transition(deps.db, order.id, "NEEDS_ATTENTION", "rpi", "OrderExceedsLimitQueue");
    return "needs_attention";
  }
  if (!order.customer_order_id) return "no_rpi_id";
  const g = await deps.rpi.get(order.customer_order_id);
  if (g.kind !== "ok") return "get_failed (reconcile will catch up)";
  if (["OrderInExceptionState", "OrderErrorAtPrinter", "OrderVoidedByPrinter"].includes(source)) {
    await applyRpiStatus(deps, order.id, { ...g.body, status: "EXCEPTION" }, "rpi");
    return "needs_attention";
  }
  return (await applyRpiStatus(deps, order.id, g.body, "rpi")) ?? "no_change";
}
