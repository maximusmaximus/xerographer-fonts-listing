import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json, notFound } from "@/lib/store/deps.server";
import { requestCancel } from "@/lib/store/cancel";
import type { OrderRow } from "@/lib/store/emails";

export const Route = createFileRoute("/api/store/order/$token/cancel")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        const [order] = await deps.db.query<OrderRow>("select * from store_orders where id = $1", [params.token]);
        if (!order || order.state === "CHECKOUT_OPEN") return notFound();
        const r = await requestCancel(deps, order, "customer");
        return json(r.status, r.body);
      },
    },
  },
});
