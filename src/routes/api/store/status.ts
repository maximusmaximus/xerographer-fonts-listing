import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json } from "@/lib/store/deps.server";
import { storeGuard } from "@/lib/store/settings";
import { copiesLeft } from "@/lib/store/slots";

/**
 * Public store status. `enabled` is decided server-side (STORE_ENV set and the config valid);
 * the nav tab and /book read it. Never reveals configuration details.
 */
export const Route = createFileRoute("/api/store/status")({
  server: {
    handlers: {
      GET: async () => {
        const deps = await storeDeps();
        if (!deps) return json(200, { enabled: false, open: false, copiesLeft: 0 });
        const guard = await storeGuard(deps.db);
        const c = await copiesLeft(deps.db, deps.config, await deps.now());
        return json(200, { enabled: true, open: guard.open, copiesLeft: c.left, dailyCap: c.cap, soldOut: c.left === 0 });
      },
    },
  },
});
