import { createFileRoute } from "@tanstack/react-router";
import { getLicenseById } from "@/lib/license";
import { corsHeaders } from "@/lib/x402";

export const Route = createFileRoute("/api/licenses/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: async ({ params }) => {
        const license = await getLicenseById(params.id);
        if (!license) return new Response("Not found", { status: 404, headers: corsHeaders() });
        return Response.json(license, { headers: corsHeaders() });
      },
    },
  },
});
