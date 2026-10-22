import { createFileRoute } from "@tanstack/react-router";
import { adminSessionOk, sameOrigin } from "@/lib/admin-auth.server";
import { sanitizeProduct } from "@/lib/product";
import { getBookProduct, saveBookProduct } from "@/lib/product.server";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/admin/product")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!adminSessionOk(request)) return json(401, { error: "unauthorized" });
        return json(200, { product: await getBookProduct() });
      },
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return json(403, { error: "bad origin" });
        if (!adminSessionOk(request)) return json(401, { error: "unauthorized" });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: "bad request" });
        }
        const parsed = sanitizeProduct(body);
        if (!parsed.ok) return json(400, { error: parsed.error });
        await saveBookProduct(parsed.product);
        return json(200, { ok: true, product: parsed.product });
      },
    },
  },
});
