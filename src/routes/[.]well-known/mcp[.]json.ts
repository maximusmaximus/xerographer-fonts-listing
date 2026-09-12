import { createFileRoute } from "@tanstack/react-router";
import { CATALOG_LICENSE_USD, LICENSE_USD } from "@/lib/constants";
import { corsHeaders } from "@/lib/x402";
import { publicOrigin } from "@/lib/utils";

export const Route = createFileRoute("/.well-known/mcp.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = publicOrigin(request);
        return Response.json(
          {
            name: "xerographer-fonts",
            description: "Xerographer Fonts catalog, live preview, and x402 commercial licensing.",
            mcp: {
              url: `${origin}/api/mcp`,
              transport: "http",
            },
            x402: {
              licenseUsd: LICENSE_USD,
              catalogLicenseUsd: CATALOG_LICENSE_USD,
              resource: `${origin}/api/licenses`,
              asset: "USDC",
              network: process.env.X402_NETWORK || "base",
            },
          },
          { headers: corsHeaders() },
        );
      },
    },
  },
});
