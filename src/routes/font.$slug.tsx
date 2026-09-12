import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout";
import { LicensePanel } from "@/components/license-panel";
import { Input } from "@/components/ui/input";
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
  const [text, setText] = useState(font.name);
  const [size, setSize] = useState(72);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const face = new FontFace(`xf-${font.slug}`, `url(/api/font-file/${font.slug})`);
    face
      .load()
      .then((loaded) => {
        if (cancelled) return;
        document.fonts.add(loaded);
        setReady(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [font.slug]);

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
            <div className="mt-8 rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)] sm:p-6">
              <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="Preview text" />
              <input
                type="range"
                min={28}
                max={160}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="mt-4 h-11 w-full accent-accent"
                aria-label="Preview size"
              />
              <p
                className="mt-6 break-words text-fg"
                style={{
                  fontFamily: ready ? `xf-${font.slug}, var(--font-display)` : "var(--font-display)",
                  fontSize: `clamp(1.5rem, ${size / 16}rem, 7rem)`,
                  lineHeight: 1.1,
                }}
              >
                {text || "Type something"}
              </p>
              {!ready ? (
                <img
                  src={`/api/preview-image/${font.slug}`}
                  alt=""
                  className="preview-invert mt-6 max-h-28 w-full object-contain object-left"
                />
              ) : null}
            </div>
            <div className="mt-8">
              <h2 className="text-xs uppercase tracking-[0.18em] text-fg-muted">Sources</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {font.hosts.map((host) => (
                  <li key={host.id} className="flex flex-wrap items-baseline gap-x-2">
                    <a className="underline-offset-4 hover:underline" href={host.url}>
                      {host.name}
                    </a>
                    {host.downloads ? (
                      <span className="font-mono text-xs tabular-nums text-fg-muted">
                        {formatDownloads(host.downloads)} downloads
                      </span>
                    ) : (
                      <span className="text-xs text-fg-muted">listing</span>
                    )}
                  </li>
                ))}
                <li>
                  <a className="underline-offset-4 hover:underline" href={font.downloadUrl}>
                    Download zip
                  </a>
                </li>
                <li>
                  <a className="underline-offset-4 hover:underline" href={font.designerUrl}>
                    Designer — maxi.grok.me
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
