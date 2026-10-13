import type { StoreDeps } from "./types.ts";
import { transition, audit } from "./state.ts";
import { cancelDeadlineFor, isAfterTodayCutoff, nextPostChargeRunUtc } from "./time.ts";
import { capCheck, storeGuard } from "./settings.ts";
import { rpiCreate } from "./rpi.ts";
import { refundInFull } from "./refunds.ts";
import { EXCLUDED_REGIONS, shipMethodForRate } from "./checkout.ts";
import { sendAlert, sendOrderConfirmation, sendProblem, type OrderRow } from "./emails.ts";
import { processCancel } from "./cancel.ts";

const PRE_LOCK = new Set(["PAID", "DEFERRED", "HELD", "RPI_CREATING", "RPI_CREATED", "CANCEL_WINDOW", "PREFLIGHT_REJECTED", "RPI_REJECTED"]);

type StripeEvent = { id: string; type: string; data: { object: Record<string, any> } };

/** Verify with the official SDK. `raw` MUST be the exact request.text() string. */
export function verifyStripeEvent(
  webhooks: { constructEvent(payload: string, header: string, secret: string): unknown },
  raw: string,
  signature: string | null,
  secret: string | undefined,
): StripeEvent | null {
  if (!signature || !secret) return null;
  try {
    return webhooks.constructEvent(raw, signature, secret) as StripeEvent;
  } catch {
    return null;
  }
}

async function orderBy(deps: StoreDeps, where: string, v: unknown): Promise<OrderRow | undefined> {
  const [o] = await deps.db.query<OrderRow>(`select * from store_orders where ${where} = $1`, [v]);
  return o;
}

async function orderForPaymentIntent(deps: StoreDeps, pi: string | undefined | null) {
  return pi ? orderBy(deps, "stripe_payment_intent_id", pi) : undefined;
}

export async function handleStripeEvent(deps: StoreDeps, event: StripeEvent): Promise<string> {
  const fresh = await deps.db.query(
    "insert into store_stripe_events (event_id, type) values ($1, $2) on conflict (event_id) do nothing returning event_id",
    [event.id, event.type],
  );
  if (!fresh.length) return "duplicate";
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
      return onCheckoutCompleted(deps, obj);
    case "checkout.session.expired": {
      const o = await orderBy(deps, "stripe_session_id", obj.id);
      if (o?.state === "CHECKOUT_OPEN") await transition(deps.db, o.id, "EXPIRED", "stripe");
      return "expired";
    }
    case "payment_intent.succeeded":
      return "logged";
    case "charge.refunded": {
      const o = await orderForPaymentIntent(deps, obj.payment_intent);
      if (!o) return "ignored";
      await audit(deps.db, o.id, "stripe", "charge.refunded");
      if (PRE_LOCK.has(o.state)) {
        await transition(deps.db, o.id, "CANCEL_REQUESTED", "stripe", "refunded in Stripe", { cancel_requested_at: (await deps.now()).toISOString() });
        await processCancel(deps, o.id, "stripe");
      }
      return "refund_recorded";
    }
    case "charge.dispute.created":
    case "radar.early_fraud_warning.created": {
      const pi = obj.payment_intent ?? obj.charge?.payment_intent;
      const o = await orderForPaymentIntent(deps, typeof pi === "string" ? pi : pi?.id);
      await sendAlert(deps, event.type, `Stripe ${event.type} for order ${o?.id.slice(0, 8) ?? "(unknown)"}. Check Stripe.`);
      if (!o) return "alerted";
      if (PRE_LOCK.has(o.state) && o.customer_order_id) await deps.rpi.cancel(o.customer_order_id);
      if (event.type === "charge.dispute.created") await transition(deps.db, o.id, "DISPUTED", "stripe", "dispute opened");
      else if (PRE_LOCK.has(o.state)) {
        await transition(deps.db, o.id, "CANCEL_REQUESTED", "stripe", "early fraud warning", { cancel_requested_at: (await deps.now()).toISOString() });
        await processCancel(deps, o.id, "stripe");
      }
      return "alerted";
    }
    default:
      return "ignored";
  }
}

async function onCheckoutCompleted(deps: StoreDeps, evtSession: Record<string, any>): Promise<string> {
  if (evtSession.payment_status !== "paid") return "not_paid";
  const token = evtSession.metadata?.order_token;
  if (!token) return "ignored (no metadata)";
  const order = await orderBy(deps, "id", token);
  if (!order || order.stripe_session_id !== evtSession.id) return "ignored (unknown order)";
  if (order.state !== "CHECKOUT_OPEN") return "already_processed";

  const s = await deps.stripe.checkout.sessions.retrieve(evtSession.id, {
    expand: ["payment_intent.latest_charge", "total_details", "shipping_cost.shipping_rate"],
  });
  if (s.payment_status !== "paid") return "not_paid";
  const ship = s.collected_information?.shipping_details ?? s.shipping_details ?? {};
  const addr = ship.address ?? {};
  const pi = s.payment_intent;
  const piId = typeof pi === "string" ? pi : pi?.id;
  const risk = typeof pi === "object" ? pi?.latest_charge?.outcome?.risk_level ?? null : null;
  const rate = s.shipping_cost?.shipping_rate;
  const method = shipMethodForRate(deps, typeof rate === "string" ? rate : rate?.id) ?? "standard";
  const paidAt = await deps.now();
  const deadline = cancelDeadlineFor(paidAt);

  const ok = await transition(deps.db, order.id, "PAID", "stripe", "checkout.session.completed", {
    stripe_payment_intent_id: piId ?? null,
    ship_method: method,
    ship_name: ship.name ?? s.customer_details?.name ?? null,
    ship_address_json: JSON.stringify({ line1: addr.line1, line2: addr.line2, city: addr.city, state: addr.state, postal_code: addr.postal_code, country: addr.country }),
    email: s.customer_details?.email ?? null,
    phone: s.customer_details?.phone ?? null,
    amount_total_cents: s.amount_total ?? null,
    amount_tax_cents: s.total_details?.amount_tax ?? null,
    amount_shipping_cents: s.total_details?.amount_shipping ?? s.shipping_cost?.amount_total ?? null,
    paid_at: paidAt.toISOString(),
    cancel_deadline_utc: deadline.toISOString(),
    risk_level: risk,
  });
  if (!ok) return "already_processed";
  let paid = (await orderBy(deps, "id", order.id))!;

  if (addr.country !== "US" || !addr.state || EXCLUDED_REGIONS.has(String(addr.state).toUpperCase())) {
    await transition(deps.db, order.id, "NEEDS_ATTENTION", "system", `unsupported address ${addr.country}/${addr.state}`);
    try {
      const amount = await refundInFull(deps, paid);
      await transition(deps.db, order.id, "CANCELLED_REFUNDED", "admin", "auto refund: unsupported address");
      await sendProblem(deps, paid, "the address isn't one our printer can deliver to (we ship to the continental US, including DC, only)", amount);
      return "refunded_unsupported_address";
    } catch {
      await sendAlert(deps, "Auto-refund failed", `Order ${order.id.slice(0, 8)} has an unsupported address and the refund failed.`);
      return "needs_attention";
    }
  }

  await sendOrderConfirmation(deps, paid);

  const guard = await storeGuard(deps.db);
  const cap = await capCheck(deps.db, paidAt, paid.amount_shipping_cents ?? 0, deps.config);
  if (!guard.open || !cap.ok || risk === "elevated" || risk === "highest") {
    const why = !guard.open ? "kill switch" : !cap.ok ? `daily cap (${cap.count} orders, $${cap.exposure})` : `Radar risk ${risk}`;
    await transition(deps.db, order.id, "HELD", "system", why);
    await sendAlert(deps, "Order held", `Order ${order.id.slice(0, 8)} is HELD: ${why}. Release it from the admin page.`);
    return "held";
  }
  if (isAfterTodayCutoff(paidAt)) {
    await transition(deps.db, order.id, "DEFERRED", "system", "paid after 4 PM PT", { deferred_until_utc: nextPostChargeRunUtc(paidAt).toISOString() });
    return "deferred";
  }
  paid = (await orderBy(deps, "id", order.id))!;
  return `rpi_${await rpiCreate(deps, paid.id, "system")}`;
}
