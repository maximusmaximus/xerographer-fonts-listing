import type { ShipMethod, StoreDeps } from "./types.ts";
import { randomToken } from "./ids.ts";
import { storeGuard } from "./settings.ts";
import { audit } from "./state.ts";

export const CHECKOUT_TEXT_SHIPPING =
  "Ships to the continental US (including DC) only. No Alaska, Hawaii, US territories, or APO/FPO addresses.";
export const CHECKOUT_TEXT_SUBMIT =
  "Each copy is printed to order. You can cancel for a full refund until 4:00 PM Pacific on the day you order (orders after 4:00 PM PT: until 4:00 PM PT the next day). After that your book goes to print and can't be cancelled or refunded. Misprinted or damaged copies are replaced free.";
export const checkoutTextTos = (base: string) =>
  `I agree to the [Terms of Sale](${base}/terms). I understand that orders can't be cancelled or refunded once printing begins, and that misprints and shipping damage are fixed with a free replacement, not a refund.`;

/** Region codes Stripe accepts under "US" that the printer can't (or we won't) ship to. */
export const EXCLUDED_REGIONS = new Set(["AK", "HI", "AA", "AE", "AP", "PR", "GU", "VI", "AS", "MP", "UM"]);

export function shipMethodForRate(deps: StoreDeps, rateId: string | null | undefined): ShipMethod | undefined {
  const r = deps.config.shippingRates;
  return (Object.keys(r) as ShipMethod[]).find((k) => r[k] === rateId);
}

export async function createCheckout(deps: StoreDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  const guard = await storeGuard(deps.db);
  if (!guard.open) return { status: 503, body: { error: "temporarily unavailable" } };
  const token = randomToken();
  await deps.db.query("insert into store_orders (id, env, state) values ($1, $2, 'CHECKOUT_OPEN')", [token, deps.config.env]);
  const base = deps.config.publicBaseUrl;
  const session = await deps.stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ price: deps.config.stripePriceId, quantity: 1 }],
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        { shipping_rate: deps.config.shippingRates.standard },
        { shipping_rate: deps.config.shippingRates.expedited },
        { shipping_rate: deps.config.shippingRates.rush },
      ],
      automatic_tax: { enabled: true },
      phone_number_collection: { enabled: true },
      consent_collection: { terms_of_service: "required" },
      custom_text: {
        shipping_address: { message: CHECKOUT_TEXT_SHIPPING },
        submit: { message: CHECKOUT_TEXT_SUBMIT },
        terms_of_service_acceptance: { message: checkoutTextTos(base) },
      },
      payment_method_types: ["card"],
      client_reference_id: token,
      metadata: { env: deps.config.env, order_token: token },
      payment_intent_data: { metadata: { env: deps.config.env, order_token: token } },
      success_url: `${base}/book/thanks?o=${token}`,
      cancel_url: `${base}/book`,
    },
    { idempotencyKey: `checkout-${token}` },
  );
  await deps.db.query("update store_orders set stripe_session_id = $2, updated_at = now() where id = $1", [token, session.id]);
  await audit(deps.db, token, "customer", "checkout session created", null, "CHECKOUT_OPEN");
  return { status: 200, body: { url: session.url } };
}
