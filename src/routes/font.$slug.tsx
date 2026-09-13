import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/layout";
import { LicensePanel } from "@/components/license-panel";
import { FontPlayground } from "@/components/playground";
import { parseFontSearch } from "@/lib/font-search";
import { getFont, withSources } from "@/lib/fonts";
import { useExplorer } from "@/lib/store";
import { formatDownloads } from "@/lib/utils";

export const Route = createFileRoute("/font/$slug")({
  validateSearch: parseFontSearch,
  loader: ({ params }) => {
    const font = getFont(params.slug);
    if (!font) throw notFound();
    return withSources(font);
  },
  component: FontPage,
});

function FontPage() {
  const font = Route.useLoaderData();
  const search = Route.useSearch();
  const catalogText = useExplorer((s) => s.previewText);
  const catalogSize = useExplorer((s) => s.previewSize);
  const catalogFg = useExplorer((s) => s.previewFg);
  const catalogBg = useExplorer((s) => s.previewBg);
  const initialText = search.text || catalogText.trim() || undefined;
  const initialSize = search.size ?? (catalogText.trim() ? catalogSize : undefined);
  const initialFg = search.fg ?? (catalogText.trim() ? catalogFg : undefined);
  const initialBg = search.bg ?? (catalogText.trim() ? catalogBg : undefined);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm text-fg-muted">
          <Link to="/" className="hover:text-fg">
            Catalog
          </Link>
          <span> / {font.category} / {font.subcategory}</span>
        </p>
        <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <h1 className="font-display text-4xl sm:text-6xl">{font.name}</h1>
            <p className="mt-2 font-mono text-sm text-fg-muted">
              {formatDownloads(font.totalDownloads)} downloads · {font.files} file{font.files === 1 ? "" : "s"}
              {font.size ? ` · ${font.size}` : ""}
            </p>
            <div className="mt-8">
              <FontPlayground
                key={`${font.slug}:${initialText ?? ""}:${initialSize ?? ""}:${initialFg ?? ""}:${initialBg ?? ""}:${search.align ?? ""}:${search.track ?? ""}:${search.lead ?? ""}:${search.case ?? ""}:${search.paper ?? ""}:${search.ink ?? ""}:${search.tx ?? ""}`}
                slug={font.slug}
                name={font.name}
                initialText={initialText}
                initialSize={initialSize}
                initialFg={initialFg}
                initialBg={initialBg}
                initialAlign={search.align}
                initialTrack={search.track}
                initialLead={search.lead}
                initialCase={search.case}
                initialFg2={search.fg2}
                initialBg2={search.bg2}
                initialPaper={search.paper}
                initialInk={search.ink}
                initialTexture={search.tx}
                initialAngle={search.ang}
              />
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
