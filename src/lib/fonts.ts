import raw from "../data/fonts.json" with { type: "json" };
import listingRaw from "../data/listings.json" with { type: "json" };
import { DAFONT_AUTHOR, DESIGNER_URL, GITHUB_FONTS_REPO, LICENSE_USD } from "./constants.ts";

export type FontRecord = {
  id: number;
  slug: string;
  name: string;
  category: string;
  subcategory: string;
  downloads: number;
  yesterday: number;
  files: number;
  size: string | null;
  charset: string[];
};

/** Zip payload at or above this is treated as a large font file on font pages. */
export const LARGE_FONT_BYTES = 500 * 1024;

export function parseFontSizeBytes(size: string | null | undefined): number | null {
  if (!size) return null;
  const match = size.trim().match(/^([\d.,]+)\s*([kKmMgG])?[bB]?$/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]!.replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = (match[2] ?? "").toUpperCase();
  const mul = unit === "G" ? 1024 ** 3 : unit === "M" ? 1024 ** 2 : unit === "K" ? 1024 : 1;
  return Math.round(value * mul);
}

export function formatFontSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    const digits = mb >= 10 ? 0 : 1;
    return `${mb.toFixed(digits).replace(/\.0$/, "")} MB`;
  }
  if (bytes >= 1024) {
    const kb = bytes / 1024;
    return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1).replace(/\.0$/, "")} KB`;
  }
  return `${bytes} B`;
}

export function isLargeFontFile(font: Pick<FontRecord, "size">): boolean {
  const bytes = parseFontSizeBytes(font.size);
  return bytes != null && bytes >= LARGE_FONT_BYTES;
}

export function largeFontNotice(font: Pick<FontRecord, "size">): string | null {
  const bytes = parseFontSizeBytes(font.size);
  if (bytes == null || bytes < LARGE_FONT_BYTES) return null;
  return `Large font file (${formatFontSize(bytes)}). Loading it might slow a computer or system.`;
}

export type HostId =
  | "dafont"
  | "github"
  | "fontspace"
  | "blogfonts"
  | "webfontfree"
  | "heyfonts"
  | "ffonts"
  | "fonts2u"
  | "fontget"
  | "whatfontis"
  | "freefonts1001";

export type HostListing = {
  id: HostId;
  name: string;
  url: string;
  downloads?: number;
};

export type FontWithSources = FontRecord & {
  previewUrl: string;
  dafontUrl: string;
  downloadUrl: string;
  designerUrl: string;
  totalDownloads: number;
  hosts: HostListing[];
};

export { DAFONT_AUTHOR, DESIGNER_URL, LICENSE_USD };

type ListingEntry = { url: string; downloads?: number };
type ListingsFile = {
  sites: { id: HostId; name: string; designerUrl: string }[];
  totals: { dafont: number; fontspace: number; webfontfree: number };
  counts: Record<string, number>;
  listings: Record<string, Partial<Record<HostId, ListingEntry>>>;
};

const catalog = raw as FontRecord[];
const listingData = listingRaw as ListingsFile;
const extraBySlug = listingData.listings;

function pascalName(name: string): string {
  return name
    .replace(/['’]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function kebabName(name: string): string {
  const splitCamel = name.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/['’]/g, "");
  return splitCamel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ffontsSlug(font: FontRecord): string {
  if (font.slug.includes("-")) {
    return font.slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("-");
  }
  return pascalName(font.name);
}

/** Hosts that list nearly the full library — every face gets a constructed page URL. */
const MIRROR_HOSTS: { id: HostId; name: string; url: (font: FontRecord) => string }[] = [
  { id: "ffonts", name: "FFonts", url: (f) => `https://www.ffonts.net/${ffontsSlug(f)}.font` },
  { id: "fonts2u", name: "Fonts2u", url: (f) => `https://fonts2u.com/${f.slug}.font` },
  { id: "fontget", name: "FontGet", url: (f) => `https://www.fontget.com/font/${kebabName(f.name)}/` },
  { id: "whatfontis", name: "WhatFontIs", url: (f) => `https://www.whatfontis.com/FF_${pascalName(f.name)}.font` },
  {
    id: "freefonts1001",
    name: "1001 Free Fonts",
    url: (f) => `https://www.1001freefonts.com/${kebabName(f.name)}.font`,
  },
];

export function extraDownloads(slug: string): number {
  const extra = extraBySlug[slug];
  if (!extra) return 0;
  let n = 0;
  for (const rec of Object.values(extra)) n += rec?.downloads ?? 0;
  return n;
}

export function totalDownloadsFor(font: FontRecord): number {
  return font.downloads + extraDownloads(font.slug);
}

export function repoPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "misc"
  );
}

export function fontRepoPath(font: Pick<FontRecord, "slug" | "category" | "subcategory">): string {
  return `fonts/${repoPart(font.category)}/${repoPart(font.subcategory)}/${font.slug}`;
}

export function githubFontUrl(font: Pick<FontRecord, "slug" | "category" | "subcategory">): string {
  return `${GITHUB_FONTS_REPO}/tree/main/${fontRepoPath(font)}`;
}

export function previewUrlFor(slug: string): string {
  const a = slug[0] ?? "x";
  const b = slug[1] ?? a;
  return `https://www.dafont.com/img/preview/${a}/${b}/${slug}0.png`;
}

export function withSources(font: FontRecord): FontWithSources {
  const dafontUrl = `https://www.dafont.com/${font.slug}.font`;
  const extra = extraBySlug[font.slug] ?? {};
  const hosts: HostListing[] = [
    { id: "dafont", name: "DaFont", url: dafontUrl, downloads: font.downloads },
    { id: "github", name: "GitHub", url: githubFontUrl(font) },
  ];
  const seen = new Set<HostId>(["dafont", "github"]);
  for (const site of listingData.sites) {
    if (seen.has(site.id)) continue;
    const hit = extra[site.id];
    if (!hit) continue;
    seen.add(site.id);
    hosts.push({
      id: site.id,
      name: site.name,
      url: hit.url,
      downloads: hit.downloads,
    });
  }
  for (const mirror of MIRROR_HOSTS) {
    if (seen.has(mirror.id)) continue;
    seen.add(mirror.id);
    hosts.push({ id: mirror.id, name: mirror.name, url: mirror.url(font) });
  }
  return {
    ...font,
    previewUrl: previewUrlFor(font.slug),
    dafontUrl,
    downloadUrl: `https://dl.dafont.com/dl/?f=${font.slug}`,
    designerUrl: DESIGNER_URL,
    totalDownloads: hosts.reduce((n, h) => n + (h.downloads ?? 0), 0),
    hosts,
  };
}

export function allFonts(): FontRecord[] {
  return catalog;
}

export function getFont(slug: string): FontRecord | undefined {
  return catalog.find((f) => f.slug === slug);
}

export function getFontOrThrow(slug: string): FontRecord {
  const font = getFont(slug);
  if (!font) throw new Error(`Unknown font: ${slug}`);
  return font;
}

export type CategoryGroup = {
  category: string;
  total: number;
  subcategories: { name: string; count: number }[];
};

export function categoryTree(): CategoryGroup[] {
  const map = new Map<string, Map<string, number>>();
  for (const font of catalog) {
    let sub = map.get(font.category);
    if (!sub) {
      sub = new Map();
      map.set(font.category, sub);
    }
    sub.set(font.subcategory, (sub.get(font.subcategory) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([category, sub]) => {
      const subcategories = [...sub.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      return {
        category,
        total: subcategories.reduce((n, s) => n + s.count, 0),
        subcategories,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type FontQuery = {
  q?: string;
  category?: string;
  subcategory?: string;
  sort?: "popular" | "name" | "recent";
  limit?: number;
  offset?: number;
};

export type FontPage = {
  total: number;
  limit: number;
  offset: number;
  fonts: FontWithSources[];
};

export function filterFonts(input: FontQuery = {}): FontRecord[] {
  const q = input.q?.trim().toLowerCase() ?? "";
  const category = input.category?.trim();
  const subcategory = input.subcategory?.trim();
  const sort = input.sort ?? "popular";

  let rows = catalog;
  if (category) rows = rows.filter((f) => f.category === category);
  if (subcategory) rows = rows.filter((f) => f.subcategory === subcategory);
  if (q) {
    rows = rows.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.includes(q) ||
        f.subcategory.toLowerCase().includes(q),
    );
  }

  const sorted = rows.slice();
  if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "recent") sorted.sort((a, b) => b.yesterday - a.yesterday);
  else sorted.sort((a, b) => totalDownloadsFor(b) - totalDownloadsFor(a));
  return sorted;
}

export function queryFonts(input: FontQuery = {}): FontPage {
  const sorted = filterFonts(input);
  const limit = Math.min(Math.max(input.limit ?? 48, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);
  return {
    total: sorted.length,
    limit,
    offset,
    fonts: sorted.slice(offset, offset + limit).map(withSources),
  };
}

const headerPool = catalog.filter((f) => f.category !== "Dingbats" && f.downloads >= 8_000);

export function pickHeaderFont(): FontRecord {
  const pool = headerPool.length ? headerPool : catalog;
  return pool[Math.floor(Math.random() * pool.length)] ?? catalog[0]!;
}

export function popularTextFaces(limit = 4): FontRecord[] {
  return filterFonts({ sort: "popular" })
    .filter((font) => font.category !== "Dingbats")
    .slice(0, Math.max(1, limit));
}

export const STATS = {
  count: catalog.length,
  dafontDownloads: listingData.totals.dafont,
  fontspaceDownloads: listingData.totals.fontspace,
  webfontfreeDownloads: listingData.totals.webfontfree,
  downloads:
    listingData.totals.dafont + listingData.totals.fontspace + listingData.totals.webfontfree,
  hosts: listingData.sites,
  hostCounts: listingData.counts,
};
