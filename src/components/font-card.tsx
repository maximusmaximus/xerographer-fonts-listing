import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FontWithSources } from "@/lib/fonts";
import { languageBadges } from "@/lib/coverage";
import { fontPreviewSearch } from "@/lib/font-search";
import { spinChar } from "@/lib/spin-char";
import { formatDownloads } from "@/lib/utils";

const faces = new Map<string, Promise<boolean>>();
const loaded = new Set<string>();

function loadFace(slug: string): Promise<boolean> {
  const hit = faces.get(slug);
  if (hit) return hit;
  const promise = (async () => {
    const face = new FontFace(`xf-${slug}`, `url(/api/font-file/${slug})`);
    const ready = await face.load();
    document.fonts.add(ready);
    loaded.add(slug);
    return true;
  })().catch(() => false);
  faces.set(slug, promise);
  return promise;
}

export function FontCard({
  font,
  previewText,
  previewSize,
  previewFg,
  previewBg,
}: {
  font: FontWithSources;
  previewText: string;
  previewSize: number;
  previewFg: string;
  previewBg: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(() => loaded.has(font.slug));
  const [failed, setFailed] = useState(false);
  const live = previewText.trim().length > 0;
  const sample = live ? previewText : font.name;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: "240px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !live) return;
    if (loaded.has(font.slug)) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void loadFace(font.slug).then((ok) => {
      if (cancelled) return;
      if (ok) setReady(true);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, live, font.slug]);

  return (
    <div ref={ref} className="min-w-0">
      <Link
        to="/font/$slug"
        params={{ slug: font.slug }}
        search={fontPreviewSearch(previewText, previewSize, previewFg, previewBg)}
        className="group flex flex-col overflow-hidden rounded-xl bg-bg-elevated shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 ease-out hover:shadow-[var(--shadow-border-hover)]"
      >
        <div
          className="preview-stage relative flex items-center overflow-hidden px-4"
          style={live ? { background: previewBg, color: previewFg } : undefined}
        >
          {live && ready ? (
            <p
              className="w-full truncate"
              style={{
                fontFamily: `xf-${font.slug}, var(--font-display)`,
                fontSize: `clamp(1.25rem, ${previewSize / 16}rem, 3.5rem)`,
                lineHeight: 1,
              }}
            >
              {sample}
            </p>
          ) : live && visible && !failed ? (
            <div className="flex h-full w-full items-center justify-center" aria-busy="true" aria-label={`Loading ${font.name}`}>
              <span className="glyph-spin select-none font-display text-4xl leading-none">
                {spinChar(sample, font.slug)}
              </span>
            </div>
          ) : visible ? (
            <SpecimenImage slug={font.slug} name={font.name} />
          ) : (
            <div className="h-16 w-full rounded-sm bg-bg-subtle" />
          )}
        </div>
        <div className="flex items-end justify-between gap-3 border-t border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{font.name}</p>
            <p className="truncate text-xs text-fg-muted">
              {font.category} / {font.subcategory}
            </p>
            <CoverageBadges slug={font.slug} />
          </div>
          <p className="shrink-0 font-mono text-xs tabular-nums text-fg-subtle">
            {formatDownloads(font.totalDownloads)}
          </p>
        </div>
      </Link>
    </div>
  );
}

function SpecimenImage({ slug, name }: { slug: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return <p className="truncate font-display text-3xl leading-none text-fg">{name}</p>;
  }
  return (
    <img
      src={`/api/preview-image/${slug}`}
      alt={`${name} specimen`}
      className="preview-invert max-h-full w-full object-contain object-left"
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

export function CoverageBadges({ slug }: { slug: string }) {
  const badges = languageBadges(slug);
  if (!badges.length) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-1" aria-label="Language support">
      {badges.map((b) => (
        <span key={b} className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-fg-muted">
          {b}
        </span>
      ))}
    </p>
  );
}
