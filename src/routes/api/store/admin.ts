import { createFileRoute } from "@tanstack/react-router";
import { adminSessionOk } from "@/lib/admin-auth.server";
import { storeDeps, json, notFound, secrets } from "@/lib/store/deps.server";
import { adminAction, adminSummary, checkAdmin } from "@/lib/store/admin";

function allowed(request: Request): boolean {
  return adminSessionOk(request) || checkAdmin(request.headers, secrets.admin());
}

export const Route = createFileRoute("/api/store/admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        if (!allowed(request)) return json(401, { error: "unauthorized" });
        return json(200, await adminSummary(deps));
      },
      POST: async ({ request }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        if (!allowed(request)) return json(401, { error: "unauthorized" });
        const body = (await request.json().catch(() => ({}))) as Parameters<typeof adminAction>[1];
        const r = await adminAction(deps, body);
        return json(r.status, r.body);
      },
    },
  },
});
