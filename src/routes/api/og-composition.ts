import { createFileRoute } from "@tanstack/react-router";
import { OG_HEIGHT, OG_WIDTH, parseOgRequest, renderCompositionPng } from "@/lib/og-composition";
import { corsHeaders } from "@/lib/x402";

export const Route = createFileRoute("/api/og-composition")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { slug, search } = parseOgRequest(new URL(request.url));
        if (!search.text) {
          return new Response("Missing text", { status: 400, headers: corsHeaders() });
        }
        try {
          const png = await renderCompositionPng(slug, search);
          if (!png) {
            return new Response(null, {
              status: 302,
              headers: { ...corsHeaders(), Location: "/og.jpg" },
            });
          }
          return new Response(Buffer.from(png), {
            headers: {
              ...corsHeaders(),
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
              "X-OG-Size": `${OG_WIDTH}x${OG_HEIGHT}`,
            },
          });
        } catch {
          return new Response(null, {
            status: 302,
            headers: { ...corsHeaders(), Location: "/og.jpg" },
          });
        }
      },
    },
  },
});
