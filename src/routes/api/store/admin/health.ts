import { createFileRoute } from "@tanstack/react-router";
import { adminSessionOk } from "@/lib/admin-auth.server";
import { env } from "@/lib/env.server";
import { storeDeps, notFound, secrets } from "@/lib/store/deps.server";
import { checkAdmin } from "@/lib/store/admin";
import { storeHealth } from "@/lib/store/health";

/** Booleans/numbers/timestamps only. No session and no token → 404 like any unknown route. */
export const Route = createFileRoute("/api/store/admin/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const deps = await storeDeps();
        const ok = adminSessionOk(request) || checkAdmin(request.headers, secrets.admin());
        if (!deps || !ok) return notFound();
        return new Response(JSON.stringify(await storeHealth(deps, env)), {
          headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" },
        });
      },
    },
  },
});
