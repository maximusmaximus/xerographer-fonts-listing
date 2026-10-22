import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json } from "@/lib/store/deps.server";
import { storeGuard } from "@/lib/store/settings";
import { copiesLeft } from "@/lib/store/slots";
import { editionStatus } from "@/lib/store/edition";

/**
 * Public store status. `enabled` is decided server-side (STORE_ENV set and the config valid);
 * the nav tab and /book read it. Never reveals configuration details.
 */
export const Route = createFileRoute("/api/store/status")({
  server: {
    handlers: {
      GET: async () => {
        const deps = await storeDeps();
        if (!deps) return json(200, { enabled: false, open: false, copiesLeft: 0, editionSize: 500, editionLeft: null, editionSoldOut: false });
        const guard = await storeGuard(deps.db);
        const now = await deps.now();
        const c = await copiesLeft(deps.db, deps.config, now);
        const e = await editionStatus(deps.db, now);
        return json(200, {
          enabled: true, open: guard.open && !e.soldOut, copiesLeft: Math.min(c.left, e.left), dailyCap: c.cap,
          soldOut: c.left === 0 || e.soldOut, editionSize: e.size, editionLeft: e.left, editionSoldOut: e.soldOut,
        });
      },
    },
  },
});
