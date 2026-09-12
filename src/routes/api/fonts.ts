import { createFileRoute } from "@tanstack/react-router";
import { categoryTree, queryFonts, STATS } from "@/lib/fonts";
import { corsHeaders } from "@/lib/x402";

export const Route = createFileRoute("/api/fonts")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sortParam = url.searchParams.get("sort");
        const page = queryFonts({
          q: url.searchParams.get("q") ?? undefined,
          category: url.searchParams.get("category") ?? undefined,
          subcategory: url.searchParams.get("subcategory") ?? undefined,
          sort: sortParam === "name" || sortParam === "recent" ? sortParam : "popular",
          limit: Number(url.searchParams.get("limit") ?? 48) || 48,
          offset: Number(url.searchParams.get("offset") ?? 0) || 0,
        });
        return Response.json(
          { stats: STATS, categories: url.searchParams.get("meta") ? categoryTree() : undefined, ...page },
          { headers: corsHeaders() },
        );
      },
    },
  },
});
