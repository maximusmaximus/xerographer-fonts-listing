import { createFileRoute } from "@tanstack/react-router";
import { adminSessionOk, sameOrigin } from "@/lib/admin-auth.server";
import { getBookProduct, saveBookProduct } from "@/lib/product.server";
import { storeDeps } from "@/lib/store/deps.server";
import { getSetting, setSetting } from "@/lib/store/settings";
import { audit } from "@/lib/store/state";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function salesOpen(): Promise<boolean | null> {
  const deps = await storeDeps();
  if (!deps) return null;
  return (await getSetting(deps.db, "ORDERS_ENABLED")) === "true";
}

export const Route = createFileRoute("/api/admin/orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!adminSessionOk(request)) return json(401, { error: "unauthorized" });
        const open = await salesOpen();
        if (open === null) return json(503, { error: "store not configured" });
        return json(200, { open });
      },
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return json(403, { error: "bad origin" });
        if (!adminSessionOk(request)) return json(401, { error: "unauthorized" });
        const deps = await storeDeps();
        if (!deps) return json(503, { error: "store not configured" });
        let enabled = false;
        try {
          const body = (await request.json()) as { enabled?: unknown };
          enabled = body.enabled === true;
        } catch {
          return json(400, { error: "bad request" });
        }
        await setSetting(deps.db, "ORDERS_ENABLED", enabled ? "true" : "false");
        await audit(deps.db, null, "admin", `ORDERS_ENABLED=${enabled}`);
        const product = await getBookProduct();
        if (product.listed !== enabled) await saveBookProduct({ ...product, listed: enabled });
        return json(200, { open: enabled });
      },
    },
  },
});
