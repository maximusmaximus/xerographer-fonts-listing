import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json, notFound, secrets } from "@/lib/store/deps.server";
import { verifyRpiSignature } from "@/lib/store/hmac";
import { handleRpiWebhook } from "@/lib/store/rpi-webhook";

export const Route = createFileRoute("/api/store/rpi/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const deps = await storeDeps();
        if (!deps) return notFound();
        const raw = await request.text();
        if (!verifyRpiSignature(raw, request.headers.get("x-rpi-printapi-hmac-sha256"), secrets.rpiWebhook())) {
          console.log("[store] rpi signature failed");
          return json(401, { error: "bad signature" });
        }
        const o = new URL(request.url).searchParams.get("o");
        try {
          const r = await handleRpiWebhook(deps, raw, o);
          console.log(`[store] rpi webhook -> ${r}`);
        } catch {
          console.log("[store] rpi webhook -> error (reconcile will catch up)");
        }
        return json(200, { received: true });
      },
    },
  },
});
