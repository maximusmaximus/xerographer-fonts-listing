import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json, notFound, secrets, stripeWebhooks } from "@/lib/store/deps.server";
import { handleStripeEvent, verifyStripeEvent } from "@/lib/store/stripe-webhook";

export const Route = createFileRoute("/api/store/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        // Raw body FIRST, exactly as received; nothing is parsed before the signature check.
        const raw = await request.text();
        const event = verifyStripeEvent(stripeWebhooks(), raw, request.headers.get("stripe-signature"), secrets.stripeWebhook());
        if (!event) {
          console.log("[store] stripe signature failed");
          return json(400, { error: "bad signature" });
        }
        try {
          const result = await handleStripeEvent(deps, event);
          console.log(`[store] stripe ${event.id} ${event.type} -> ${result}`);
          return json(200, { received: true });
        } catch {
          console.log(`[store] stripe ${event.id} ${event.type} -> error`);
          // Let Stripe retry; the event id was recorded only if processing began, so allow a re-run.
          await deps.db.query("delete from store_stripe_events where event_id = $1", [event.id]).catch(() => undefined);
          return json(500, { error: "processing failed" });
        }
      },
    },
  },
});
