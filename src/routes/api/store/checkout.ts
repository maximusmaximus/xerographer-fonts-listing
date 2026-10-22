import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json, notFound } from "@/lib/store/deps.server";
import { createCheckout } from "@/lib/store/checkout";

export const Route = createFileRoute("/api/store/checkout")({
  server: {
    handlers: {
      POST: async () => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        try {
          const r = await createCheckout(deps);
          return json(r.status, r.body);
        } catch {
          console.log("[store] checkout create failed");
          return json(503, { error: "temporarily unavailable" });
        }
      },
    },
  },
});
