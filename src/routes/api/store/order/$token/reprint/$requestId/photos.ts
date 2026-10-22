import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json, notFound } from "@/lib/store/deps.server";
import { uploadClaimPhoto } from "@/lib/store/photos";

export const Route = createFileRoute("/api/store/order/$token/reprint/$requestId/photos")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        const r = await uploadClaimPhoto(deps, params.token, params.requestId, request.headers.get("content-length"), () => request.arrayBuffer());
        return r.status === 404 ? notFound() : json(r.status, r.body);
      },
    },
  },
});
