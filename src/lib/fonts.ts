import raw from "../data/fonts.json" with { type: "json" };
import listingRaw from "../data/listings.json" with { type: "json" };
import { DAFONT_AUTHOR, DESIGNER_URL, LICENSE_USD } from "./constants.ts";

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

export type HostId = "dafont" | "fontspace" | "blogfonts" | "webfontfree" | "heyfonts";

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
  ];
  for (const site of listingData.sites) {
    if (site.id === "dafont") continue;
    const hit = extra[site.id];
    if (!hit) continue;
    hosts.push({
      id: site.id,
      name: site.name,
      url: hit.url,
      downloads: hit.downloads,
    });
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
