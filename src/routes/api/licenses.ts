import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { purchaseLicense } from "@/lib/license";
import { corsHeaders } from "@/lib/x402";
import { publicOrigin } from "@/lib/utils";

const Body = z
  .object({
    slug: z.string().min(1).optional(),
    catalog: z.boolean().optional(),
    email: z.string().email().optional(),
    licenseeName: z.string().max(200).optional(),
  })
  .refine((value) => value.catalog || value.slug, { message: "slug or catalog is required" });

export const Route = createFileRoute("/api/licenses")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "JSON body required" }, { status: 400, headers: corsHeaders() });
        }
        const parsed = Body.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "slug or catalog is required" }, { status: 400, headers: corsHeaders() });
        }
        return purchaseLicense(request, { ...parsed.data, origin: publicOrigin(request) });
      },
    },
  },
});
