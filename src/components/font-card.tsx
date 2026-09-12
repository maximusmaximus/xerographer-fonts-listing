import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FontWithSources } from "@/lib/fonts";
import { fontPreviewSearch } from "@/lib/font-search";
import { formatDownloads } from "@/lib/utils";

const faces = new Map<string, Promise<boolean>>();

function loadFace(slug: string): Promise<boolean> {
  const hit = faces.get(slug);
  if (hit) return hit;
  const promise = (async () => {
    const face = new FontFace(`xf-${slug}`, `url(/api/font-file/${slug})`);
    const ready = await face.load();
    document.fonts.add(ready);
    return true;
  })().catch(() => false);
  faces.set(slug, promise);
  return promise;
}

export function FontCard({
  font,
  previewText,
  previewSize,
}: {
  font: FontWithSources;
  previewText: string;
  previewSize: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const live = previewText.trim().length > 0;

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
    let cancelled = false;
    void loadFace(font.slug).then((ok) => {
      if (!cancelled) setReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, live, font.slug]);

  return (
    <div ref={ref}>
      <Link
        to="/font/$slug"
        params={{ slug: font.slug }}
        search={fontPreviewSearch(previewText, previewSize)}
        className="group flex flex-col overflow-hidden rounded-xl bg-bg-elevated shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 ease-out hover:shadow-[var(--shadow-border-hover)]"
      >
        <div className="relative flex min-h-32 items-center overflow-hidden px-4 py-6 sm:min-h-40">
          {live ? (
            <p
              className="w-full truncate text-fg"
              style={{
                fontFamily: ready ? `xf-${font.slug}, var(--font-display)` : "var(--font-display)",
                fontSize: `clamp(1.25rem, ${previewSize / 16}rem, 4.5rem)`,
                lineHeight: 1.1,
              }}
            >
              {previewText}
            </p>
          ) : visible ? (
            <img
              src={`/api/preview-image/${font.slug}`}
              alt={`${font.name} specimen`}
              className="preview-invert max-h-24 w-full object-contain object-left sm:max-h-28"
              loading="lazy"
            />
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
          </div>
          <p className="shrink-0 font-mono text-xs tabular-nums text-fg-subtle">
            {formatDownloads(font.totalDownloads)}
          </p>
        </div>
      </Link>
    </div>
  );
}
