import { createFileRoute } from "@tanstack/react-router";
import { handleMcp } from "@/lib/mcp";
import { publicOrigin } from "@/lib/utils";

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      GET: async ({ request }) => handleMcp(request, publicOrigin(request)),
      POST: async ({ request }) => handleMcp(request, publicOrigin(request)),
    },
  },
});
