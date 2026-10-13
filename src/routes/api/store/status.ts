import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json } from "@/lib/store/deps.server";
import { storeGuard } from "@/lib/store/settings";

/** Public: is the store taking orders? Never reveals configuration details. */
export const Route = createFileRoute("/api/store/status")({
  server: {
    handlers: {
      GET: async () => {
        const deps = await storeDeps();
        if (!deps) return json(200, { open: false });
        return json(200, { open: (await storeGuard(deps.db)).open });
      },
    },
  },
});
