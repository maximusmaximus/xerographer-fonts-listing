import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, notFound } from "@/lib/store/deps.server";
import { readPhoto } from "@/lib/store/photos";

export const Route = createFileRoute("/api/store/order/$token/photos/$photoId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        const p = await readPhoto(deps.db, params.photoId, params.token);
        if (p.status === 404) return notFound();
        if (p.status === 410) return new Response(null, { status: 410, headers: { "Cache-Control": "private, no-store" } });
        return new Response(p.bytes, { status: 200, headers: p.headers });
      },
    },
  },
});
