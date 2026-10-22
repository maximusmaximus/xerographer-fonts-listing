import type { StoreDeps } from "./types.ts";
import type { OrderRow } from "./emails.ts";

/** Full refund (book + shipping + tax). Idempotent per order via the Stripe idempotency key. */
export async function refundInFull(deps: StoreDeps, order: OrderRow, reason: "requested_by_customer" | "duplicate" | "fraud" = "requested_by_customer") {
  if (!order.stripe_payment_intent_id) throw new Error("no payment intent");
  const r = await deps.stripe.refunds.create(
    { payment_intent: order.stripe_payment_intent_id, reason },
    { idempotencyKey: `refund-full-${order.id}` },
  );
  return r.amount;
}
