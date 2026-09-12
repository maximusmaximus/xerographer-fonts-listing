import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/layout";
import { LicensePanel } from "@/components/license-panel";
import { FontPlayground } from "@/components/playground";
import { getFont, withSources } from "@/lib/fonts";
import { formatDownloads } from "@/lib/utils";

export const Route = createFileRoute("/font/$slug")({
  loader: ({ params }) => {
    const font = getFont(params.slug);
    if (!font) throw notFound();
    return withSources(font);
  },
  component: FontPage,
});

function FontPage() {
  const font = Route.useLoaderData();

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm text-fg-muted">
          <Link to="/" className="hover:text-fg">
            Catalog
          </Link>
          <span> / {font.category} / {font.subcategory}</span>
        </p>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <h1 className="font-display text-4xl sm:text-6xl">{font.name}</h1>
            <p className="mt-2 font-mono text-sm text-fg-muted">
              {formatDownloads(font.totalDownloads)} downloads · {font.files} file{font.files === 1 ? "" : "s"}
              {font.size ? ` · ${font.size}` : ""}
            </p>
            <div className="mt-8">
              <FontPlayground slug={font.slug} name={font.name} />
            </div>
            <div className="mt-8">
              <h2 className="text-xs uppercase tracking-[0.18em] text-fg-muted">Sources</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {font.hosts.map((host) => (
                  <li key={host.id}>
                    <a
                      href={host.url}
                      className="inline-flex h-11 items-center rounded-full bg-bg-subtle px-3 text-sm text-fg transition-colors hover:bg-bg-elevated"
                    >
                      {host.name}
                      {host.downloads ? (
                        <span className="ml-2 font-mono text-xs tabular-nums text-fg-muted">
                          {formatDownloads(host.downloads)}
                        </span>
                      ) : null}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    className="inline-flex h-11 items-center rounded-full bg-bg-subtle px-3 text-sm text-fg transition-colors hover:bg-bg-elevated"
                    href={font.downloadUrl}
                  >
                    Download zip
                  </a>
                </li>
                <li>
                  <a
                    className="inline-flex h-11 items-center rounded-full bg-bg-subtle px-3 text-sm text-fg transition-colors hover:bg-bg-elevated"
                    href={font.designerUrl}
                  >
                    Designer
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <LicensePanel font={font} />
        </div>
      </div>
    </PageShell>
  );
}
