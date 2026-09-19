import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ColorWheel } from "@/components/color-wheel";
import { FontCard } from "@/components/font-card";
import { HintSpot } from "@/components/guide";
import { ShareComposition } from "@/components/share-composition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryTree, filterFonts, STATS, withSources, type FontQuery } from "@/lib/fonts";
import { compositionHref, compositionOgHref, serializeComposition, type FontSearch } from "@/lib/font-search";
import { useExplorer } from "@/lib/store";
import { formatDownloads, formatDownloadsLong } from "@/lib/utils";

const PAGE = 36;
const HERO_KEY = "xf-hero";

export function CatalogExplorer({ incoming }: { incoming?: FontSearch }) {
  const {
    previewText,
    previewSize,
    previewFg,
    previewBg,
    query,
    category,
    subcategory,
    sort,
    setPreviewText,
    setPreviewSize,
    setPreviewFg,
    setPreviewBg,
    setQuery,
    setCategory,
    setSort,
  } = useExplorer();
  const [heroOpen, setHeroOpen] = useState(true);
  const navigate = useNavigate({ from: "/" });
  const seeded = useRef(false);

  useEffect(() => {
    if (localStorage.getItem(HERO_KEY) === "hidden") setHeroOpen(false);
  }, []);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (!incoming?.text) return;
    setPreviewText(incoming.text);
    if (incoming.size) setPreviewSize(incoming.size);
    if (incoming.fg) setPreviewFg(incoming.fg);
    if (incoming.bg) setPreviewBg(incoming.bg);
  }, [incoming, setPreviewBg, setPreviewFg, setPreviewSize, setPreviewText]);

  useEffect(() => {
    if (!seeded.current) return;
    const handle = window.setTimeout(() => {
      void navigate({
        search: serializeComposition({
          text: previewText,
          size: previewSize,
          fg: previewFg,
          bg: previewBg,
        }),
        replace: true,
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [navigate, previewBg, previewFg, previewSize, previewText]);

  function dismissHero() {
    setHeroOpen(false);
    try {
      localStorage.setItem(HERO_KEY, "hidden");
    } catch {
      /* private mode */
    }
  }

  const live = previewText.trim().length > 0;
  const tree = useMemo(() => categoryTree(), []);
  const filter: FontQuery = {
    q: query,
    category: category ?? undefined,
    subcategory: subcategory ?? undefined,
    sort,
  };

  return (
    <div>
      <section
        className={`grain mx-auto max-w-7xl px-4 pb-8 sm:px-6 ${heroOpen ? "pt-10 sm:pt-16" : "pt-6 sm:pt-8"}`}
      >
        {heroOpen ? (
          <div className="relative pr-12">
            <button
              type="button"
              aria-label="Hide foundry intro"
              onClick={dismissHero}
              className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
            >
              <X className="size-4" />
            </button>
            <p className="text-xs uppercase tracking-[0.22em] text-fg-muted">Independent type foundry</p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl text-fg sm:text-6xl">
              {formatDownloadsLong(STATS.downloads)} downloads.
            </h1>
            <p className="mt-4 max-w-xl text-fg-muted">
              {STATS.count.toLocaleString()} original typefaces. Type a line — every face on screen will set it.
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HeroStat label="Typefaces" value={STATS.count.toLocaleString()} />
              <HeroStat label="DaFont" value={formatDownloads(STATS.dafontDownloads)} />
              <HeroStat label="FontSpace" value={formatDownloads(STATS.fontspaceDownloads)} />
              <HeroStat label="WebFontFree" value={formatDownloads(STATS.webfontfreeDownloads)} />
            </dl>
            <p className="mt-4 text-xs text-fg-muted">
              Also listed on{" "}
              <a className="underline-offset-4 hover:underline" href="https://blogfonts.com/user/424.htm">
                BlogFonts
              </a>{" "}
              ({STATS.hostCounts.blogfonts}) and{" "}
              <a
                className="underline-offset-4 hover:underline"
                href="https://www.heyfonts.com/designer/max-infeld-xerographer-fonts/"
              >
                Hey Fonts
              </a>{" "}
              ({STATS.hostCounts.heyfonts}). Totals are summed across hosts.
            </p>
          </div>
        ) : null}
        <div className={`${heroOpen ? "mt-8" : ""} rounded-xl bg-bg-elevated p-3 shadow-[var(--shadow-border)] sm:p-4`}>
          <HintSpot id="tester">
            <label className="sr-only" htmlFor="tester">
              Preview text
            </label>
            <Input
              id="tester"
              value={previewText}
              placeholder="Type to test any face…"
              onChange={(e) => setPreviewText(e.target.value)}
              className="h-14 border-0 bg-transparent text-lg shadow-none sm:text-xl"
            />
          </HintSpot>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            {live ? (
              <HintSpot id="size" className="flex-1">
                <label className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-fg-muted">
                  Size
                  <input
                    type="range"
                    min={28}
                    max={120}
                    value={previewSize}
                    onChange={(e) => setPreviewSize(Number(e.target.value))}
                    className="h-11 w-full min-w-0 accent-accent"
                    aria-label="Preview size"
                    suppressHydrationWarning
                  />
                </label>
              </HintSpot>
            ) : null}
            {live ? (
              <HintSpot id="colors">
                <div className="flex min-w-0 flex-wrap items-end gap-4">
                  <ColorWheel label="Paper" value={previewBg} onChange={setPreviewBg} size={104} />
                  <ColorWheel label="Ink" value={previewFg} onChange={setPreviewFg} size={104} />
                </div>
              </HintSpot>
            ) : null}
            {live ? (
              <HintSpot id="share">
                <ShareComposition
                  url={compositionHref("/", {
                    text: previewText,
                    size: previewSize,
                    fg: previewFg,
                    bg: previewBg,
                  })}
                  ogUrl={compositionOgHref("/", {
                    text: previewText,
                    size: previewSize,
                    fg: previewFg,
                    bg: previewBg,
                  })}
                  title={`${previewText.trim()} — Xerographer preview`}
                />
              </HintSpot>
            ) : (
              <HintSpot id="share">
                <ShareComposition url="" title="Xerographer preview" disabled />
              </HintSpot>
            )}
            <HintSpot id="search" className="sm:max-w-xs sm:flex-1">
              <Input
                value={query}
                placeholder="Search names"
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search fonts"
              />
            </HintSpot>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
            {(["popular", "name", "recent"] as const).map((key) => (
              <Button key={key} size="sm" variant={sort === key ? "primary" : "secondary"} onClick={() => setSort(key)}>
                {key}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid min-w-0 max-w-7xl gap-8 overflow-x-hidden px-4 pb-20 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <HintSpot id="categories">
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-fg-muted">Look by category</p>
          <div className="-mx-4 flex max-w-[100vw] gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:max-w-none lg:flex-col lg:overflow-visible lg:px-0">
            <CategoryChip label={`All (${STATS.count})`} active={!category} onClick={() => setCategory(null)} />
            {tree.map((group) => (
              <div key={group.category} className="contents lg:flex lg:flex-col lg:gap-1">
                <CategoryChip
                  label={`${group.category} (${group.total})`}
                  active={category === group.category && !subcategory}
                  onClick={() => setCategory(group.category)}
                />
                {category === group.category
                  ? group.subcategories.map((sub) => (
                      <CategoryChip
                        key={sub.name}
                        label={`${sub.name} (${sub.count})`}
                        nested
                        active={subcategory === sub.name}
                        onClick={() => setCategory(group.category, sub.name)}
                      />
                    ))
                  : null}
              </div>
            ))}
          </div>
          </HintSpot>
          <div className="mt-4 hidden gap-2 lg:flex">
            {(["popular", "name", "recent"] as const).map((key) => (
              <Button key={key} size="sm" variant={sort === key ? "primary" : "secondary"} onClick={() => setSort(key)}>
                {key}
              </Button>
            ))}
          </div>
        </aside>
        <HintSpot id="cards">
        <FontGrid
          filter={filter}
          previewText={previewText}
          previewSize={previewSize}
          previewFg={previewFg}
          previewBg={previewBg}
        />
        </HintSpot>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg-elevated px-4 py-4 shadow-[var(--shadow-border)]">
      <dt className="text-xs uppercase tracking-[0.16em] text-fg-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  nested,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  nested?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 shrink-0 rounded-full px-3 text-left text-sm transition-colors lg:h-9 ${
        nested ? "lg:pl-4 text-fg-muted" : ""
      } ${active ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg hover:bg-bg-elevated"}`}
    >
      {label}
    </button>
  );
}

function FontGrid({
  filter,
  previewText,
  previewSize,
  previewFg,
  previewBg,
}: {
  filter: FontQuery;
  previewText: string;
  previewSize: number;
  previewFg: string;
  previewBg: string;
}) {
  const fonts = useMemo(() => filterFonts(filter).map(withSources), [filter]);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    setShown(PAGE);
  }, [filter.q, filter.category, filter.subcategory, filter.sort]);

  const visible = fonts.slice(0, shown);
  return (
    <section className="min-w-0">
      <p className="mb-4 text-sm text-fg-muted">
        <span className="tabular-nums text-fg">{fonts.length.toLocaleString()}</span> faces
      </p>
      {visible.length === 0 ? (
        <p className="rounded-xl bg-bg-elevated px-4 py-12 text-center text-fg-muted shadow-[var(--shadow-border)]">
          No faces match that filter.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((font) => (
            <FontCard
              key={font.slug}
              font={font}
              previewText={previewText}
              previewSize={previewSize}
              previewFg={previewFg}
              previewBg={previewBg}
            />
          ))}
        </div>
      )}
      {visible.length < fonts.length ? (
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
            Load more
          </Button>
        </div>
      ) : null}
    </section>
  );
}
