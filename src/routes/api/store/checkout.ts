import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json, notFound } from "@/lib/store/deps.server";
import { createCheckout } from "@/lib/store/checkout";
import type { ShipMethod } from "@/lib/store/types";

const SHIP: ReadonlySet<string> = new Set(["standard", "expedited", "rush"]);

export const Route = createFileRoute("/api/store/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        let ship: ShipMethod;
        try {
          const body = (await request.json()) as { ship?: unknown };
          if (typeof body.ship !== "string" || !SHIP.has(body.ship)) return json(400, { error: "choose shipping" });
          ship = body.ship as ShipMethod;
        } catch {
          return json(400, { error: "choose shipping" });
        }
        try {
          const r = await createCheckout(deps, ship);
          return json(r.status, r.body);
        } catch {
          console.log("[store] checkout create failed");
          return json(503, { error: "temporarily unavailable" });
        }
      },
    },
  },
});