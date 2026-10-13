import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json, notFound } from "@/lib/store/deps.server";
import { createReprintRequest } from "@/lib/store/photos";
import type { OrderRow } from "@/lib/store/emails";

export const Route = createFileRoute("/api/store/order/$token/reprint")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        const [order] = await deps.db.query<OrderRow>("select * from store_orders where id = $1", [params.token]);
        if (!order) return notFound();
        const body = (await request.json().catch(() => ({}))) as { description?: string };
        const r = await createReprintRequest(deps, order, String(body.description ?? ""));
        return json(r.status, r.body);
      },
    },
  },
});
