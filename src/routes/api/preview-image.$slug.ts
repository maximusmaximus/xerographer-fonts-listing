import { createFileRoute } from "@tanstack/react-router";
import { getFont, previewUrlFor } from "@/lib/fonts";
import { dafontGet } from "@/lib/outbound";
import { corsHeaders } from "@/lib/x402";

const cache = new Map<string, { bytes: Buffer; type: string }>();

export const Route = createFileRoute("/api/preview-image/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const font = getFont(params.slug);
        if (!font) return new Response("Not found", { status: 404, headers: corsHeaders() });
        const hit = cache.get(params.slug);
        if (hit) {
          return new Response(new Uint8Array(hit.bytes), {
            headers: {
              ...corsHeaders(),
              "Content-Type": hit.type,
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
        try {
          const fetched = await dafontGet(previewUrlFor(params.slug), {
            Referer: `https://www.dafont.com/${params.slug}.font`,
            Accept: "image/png,image/*,*/*",
          });
          if (fetched.status < 200 || fetched.status >= 300 || fetched.bytes.byteLength < 40) {
            return fallbackNameCard(font.name);
          }
          const type = fetched.contentType.includes("image") ? fetched.contentType : "image/png";
          if (cache.size > 200) {
            const first = cache.keys().next().value;
            if (first) cache.delete(first);
          }
          cache.set(params.slug, { bytes: fetched.bytes, type });
          return new Response(new Uint8Array(fetched.bytes), {
            headers: {
              ...corsHeaders(),
              "Content-Type": type,
              "Cache-Control": "public, max-age=86400",
            },
          });
        } catch {
          return fallbackNameCard(font.name);
        }
      },
    },
  },
});

function fallbackNameCard(name: string): Response {
  const safe = name.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160" viewBox="0 0 640 160">
<rect width="640" height="160" fill="#121212"/>
<text x="32" y="96" fill="#f2efe6" font-size="48" font-family="Georgia, serif">${safe}</text>
</svg>`;
  return new Response(svg, {
    headers: {
      ...corsHeaders(),
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
