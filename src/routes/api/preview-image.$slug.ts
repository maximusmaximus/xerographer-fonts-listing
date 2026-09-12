import { createFileRoute } from "@tanstack/react-router";
import { getFont, previewUrlFor } from "@/lib/fonts";
import { corsHeaders } from "@/lib/x402";

export const Route = createFileRoute("/api/preview-image/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!getFont(params.slug)) return new Response("Not found", { status: 404, headers: corsHeaders() });
        const res = await fetch(previewUrlFor(params.slug), {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; XerographerCatalog/1.0)",
            Referer: `https://www.dafont.com/${params.slug}.font`,
          },
        });
        if (!res.ok) return new Response("Preview unavailable", { status: 502, headers: corsHeaders() });
        const bytes = await res.arrayBuffer();
        return new Response(bytes, {
          headers: {
            ...corsHeaders(),
            "Content-Type": res.headers.get("content-type") || "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
