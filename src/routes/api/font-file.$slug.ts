import { createFileRoute } from "@tanstack/react-router";
import { loadFontFile } from "@/lib/font-file";
import { corsHeaders } from "@/lib/x402";

export const Route = createFileRoute("/api/font-file/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = await loadFontFile(params.slug);
        if (!file) return new Response("Font file unavailable", { status: 404, headers: corsHeaders() });
        return new Response(Buffer.from(file.bytes), {
          headers: {
            ...corsHeaders(),
            "Content-Type": file.contentType,
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": `inline; filename="${file.filename}"`,
          },
        });
      },
    },
  },
});
