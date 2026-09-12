import { createFileRoute } from "@tanstack/react-router";
import { getLicenseById, pdfForLicense } from "@/lib/license";
import { corsHeaders } from "@/lib/x402";

export const Route = createFileRoute("/api/licenses/$id/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const license = await getLicenseById(params.id);
        if (!license) return new Response("Not found", { status: 404, headers: corsHeaders() });
        const pdf = await pdfForLicense(license);
        return new Response(Buffer.from(pdf), {
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="xerographer-${license.fontSlug}-license.pdf"`,
          },
        });
      },
    },
  },
});
