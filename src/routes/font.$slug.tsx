import { createFileRoute, notFound } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { HintSpot } from "@/components/guide";
import { PageShell } from "@/components/layout";
import { LicensePanel } from "@/components/license-panel";
import { FontPlayground } from "@/components/playground";
import { parseFontSearch } from "@/lib/font-search";
import { getFont, withSources, type FontWithSources } from "@/lib/fonts";
import { currentTourStep, useGuide } from "@/lib/guide";
import { useExplorer } from "@/lib/store";
import { formatDownloads } from "@/lib/utils";

export const Route = createFileRoute("/font/$slug")({
  validateSearch: parseFontSearch,
  loader: ({ params }) => {
    const font = getFont(params.slug);
    if (!font) throw notFound();
    return withSources(font);
  },
  head: ({ loaderData, match }) => {
    const font = loaderData;
    const text = match.search.text?.trim();
    const title = text
      ? `${text} · ${font?.name ?? "Font"} — Xerographer Fonts`
      : `${font?.name ?? "Font"} — Xerographer Fonts`;
    return { meta: [{ title }] };
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
  const [metaOpen, setMetaOpen] = useState(false);
  const tourRoute = useGuide((s) => s.tourRoute);
  const tourIndex = useGuide((s) => s.tourIndex);
  const step = currentTourStep(tourRoute, tourIndex);
  const showMeta = metaOpen || step?.id === "license" || step?.id === "sources";

  useEffect(() => {
    const sync = () => {
      if (window.location.hash === "#license") setMetaOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <PageShell chrome="studio">
      <FontPlayground
        key={font.slug}
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
        onOpenLicense={() => setMetaOpen(true)}
      />
      {showMeta ? <FontMetaSheet font={font} onClose={() => setMetaOpen(false)} /> : null}
    </PageShell>
  );
}

function FontMetaSheet({ font, onClose }: { font: FontWithSources; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2">
        <button
          type="button"
          aria-label="Close license and sources"
          onClick={onClose}
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-bg-subtle"
        >
          <X className="size-4" />
        </button>
        <p className="min-w-0 truncate font-display text-lg tracking-tight">{font.name}</p>
        <p className="ml-auto hidden shrink-0 font-mono text-xs tabular-nums text-fg-muted sm:block">
          {formatDownloads(font.totalDownloads)} downloads
          {font.size ? ` · ${font.size}` : ""}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <HintSpot id="sources">
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
          </HintSpot>
          <div id="license">
            <LicensePanel font={font} />
          </div>
        </div>
      </div>
    </div>
  );
}