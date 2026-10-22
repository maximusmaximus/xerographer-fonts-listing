import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, notFound, json, secrets } from "@/lib/store/deps.server";
import { readPhoto } from "@/lib/store/photos";
import { checkAdmin } from "@/lib/store/admin";

export const Route = createFileRoute("/api/store/admin/photos/$photoId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        if (!checkAdmin(request.headers, secrets.admin())) return json(401, { error: "unauthorized" });
        const p = await readPhoto(deps.db, params.photoId);
        if (p.status === 404) return notFound();
        if (p.status === 410) return new Response(null, { status: 410, headers: { "Cache-Control": "private, no-store" } });
        return new Response(p.bytes, { status: 200, headers: p.headers });
      },
    },
  },
});
