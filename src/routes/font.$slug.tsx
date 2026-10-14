import { createFileRoute, notFound } from "@tanstack/react-router";
import { Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { HintSpot } from "@/components/guide";
import { PageShell } from "@/components/layout";
import { CoverageBadges } from "@/components/font-card";
import { LicensePanel } from "@/components/license-panel";
import { FontPlayground } from "@/components/playground";
import { accentSamples, coverageFor } from "@/lib/coverage";
import { parseFontSearch } from "@/lib/font-search";
import { getFont, largeFontNotice, withSources, type FontWithSources } from "@/lib/fonts";
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
  const notice = largeFontNotice(font);

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
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        {notice ? <LargeFontNotice message={notice} /> : null}
        <div className="min-h-0 min-w-0 flex-1">
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
        </div>
      </div>
      {showMeta ? <FontMetaSheet font={font} onClose={() => setMetaOpen(false)} /> : null}
    </PageShell>
  );
}

function LargeFontNotice({ message }: { message: string }) {
  return (
    <p
      role="status"
      data-large-font-notice=""
      className="shrink-0 border-b border-border bg-bg-subtle px-3 py-2 text-sm leading-snug text-fg sm:px-4"
    >
      <span className="inline-flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden />
        <span>{message}</span>
      </span>
    </p>
  );
}

function FontMetaSheet({ font, onClose }: { font: FontWithSources; onClose: () => void }) {
  const notice = largeFontNotice(font);
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
      {notice ? <LargeFontNotice message={notice} /> : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <AccentSpecimen slug={font.slug} />
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
function AccentSpecimen({ slug }: { slug: string }) {
  const lines = accentSamples(slug);
  const cov = coverageFor(slug);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!lines.length) return;
    const family = `xf-${slug}`;
    if ([...document.fonts].some((f) => f.family === family)) {
      setReady(true);
      return;
    }
    const face = new FontFace(family, `url(/api/font-file/${slug})`);
    let cancelled = false;
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        if (!cancelled) setReady(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slug, lines.length]);
  if (!lines.length) return null;
  return (
    <section className="lg:col-span-2">
      <h2 className="text-xs uppercase tracking-[0.18em] text-fg-muted">Language support</h2>
      <CoverageBadges slug={slug} />
      {cov?.glyphs ? <p className="mt-1 text-xs text-fg-muted">{cov.glyphs} glyphs</p> : null}
      <div className="mt-3 space-y-2" style={{ fontFamily: ready ? `xf-${slug}, var(--font-display)` : undefined }}>
        {lines.map((line) => (
          <p key={line} className="text-3xl leading-tight text-fg">
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
