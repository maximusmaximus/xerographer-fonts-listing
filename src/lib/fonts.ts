import raw from "../data/fonts.json" with { type: "json" };
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

export type FontWithSources = FontRecord & {
  previewUrl: string;
  dafontUrl: string;
  downloadUrl: string;
  fontspaceSearch: string;
  designerUrl: string;
};

export { DAFONT_AUTHOR, DESIGNER_URL, LICENSE_USD };

const catalog = raw as FontRecord[];

export function previewUrlFor(slug: string): string {
  const a = slug[0] ?? "x";
  const b = slug[1] ?? a;
  return `https://www.dafont.com/img/preview/${a}/${b}/${slug}0.png`;
}

export function withSources(font: FontRecord): FontWithSources {
  return {
    ...font,
    previewUrl: previewUrlFor(font.slug),
    dafontUrl: `https://www.dafont.com/${font.slug}.font`,
    downloadUrl: `https://dl.dafont.com/dl/?f=${font.slug}`,
    fontspaceSearch: `https://www.fontspace.com/search?q=${encodeURIComponent(font.name + " xerographer")}`,
    designerUrl: DESIGNER_URL,
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
  else sorted.sort((a, b) => b.downloads - a.downloads);
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

export const STATS = {
  count: catalog.length,
  downloads: catalog.reduce((n, f) => n + f.downloads, 0),
  categories: categoryTree().length,
};
