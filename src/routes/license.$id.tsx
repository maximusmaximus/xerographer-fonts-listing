import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";

const loadLicense = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { getLicenseById } = await import("@/lib/license");
    const license = await getLicenseById(data.id);
    if (!license) return null;
    return {
      id: license.id,
      fontName: license.fontName,
      fontSlug: license.fontSlug,
      payerId: license.payerId,
      email: license.email,
      createdAt: license.createdAt,
      grant: license.receipt.grant,
      transaction: license.receipt.transaction,
      network: license.receipt.network,
    };
  });

export const Route = createFileRoute("/license/$id")({
  loader: async ({ params }) => {
    const license = await loadLicense({ data: { id: params.id } });
    if (!license) throw notFound();
    return license;
  },
  component: LicensePage,
});

function LicensePage() {
  const license = Route.useLoaderData();
  return (
    <PageShell>
      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-fg-muted">x402 receipt</p>
        <h1 className="mt-3 font-display text-4xl">Unlimited commercial use</h1>
        <p className="mt-4 text-fg-muted">{license.grant.permission}</p>
        <dl className="mt-8 space-y-3 text-sm">
          <Row label="Typeface" value={`${license.fontName} (${license.fontSlug})`} />
          <Row label="Licensee" value={license.payerId} />
          <Row label="Email" value={license.email ?? "—"} />
          <Row label="Network" value={license.network} />
          <Row label="Transaction" value={license.transaction} />
          <Row label="DaFont" value={license.grant.sources.dafont} href={license.grant.sources.dafont} />
          <Row label="Download" value={license.grant.sources.download} href={license.grant.sources.download} />
        </dl>
        <Button className="mt-8" asChild>
          <a href={`/api/licenses/${license.id}/pdf`}>Download PDF</a>
        </Button>
      </article>
    </PageShell>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[140px_1fr]">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="break-all font-mono text-xs sm:text-sm">
        {href ? (
          <a className="underline-offset-4 hover:underline" href={href}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
