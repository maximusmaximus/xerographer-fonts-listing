import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json, notFound } from "@/lib/store/deps.server";
import { publicOrderView } from "@/lib/store/order-view";

export const Route = createFileRoute("/api/store/order/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        const view = await publicOrderView(deps, params.token);
        return view ? json(200, view) : notFound();
      },
    },
  },
});
