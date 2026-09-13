import { loadFontFile } from "./font-file";
import { getFont, popularTextFaces } from "./fonts";
import { parseFontSearch, type FontSearch } from "./font-search";
import { outlineGlyphs, type SpecimenStyle } from "./specimen-render";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const cache = new Map<string, Uint8Array>();

function styleFromSearch(search: FontSearch, width: number, fontSize: number): SpecimenStyle {
  const size = search.size ?? 72;
  const tracking = search.track ?? 0;
  const leading = search.lead ?? 1.15;
  return {
    text: search.text?.trim() || "Xerographer",
    caseMode: search.case ?? "none",
    align: search.align ?? "left",
    fontSize,
    trackingPx: tracking * fontSize,
    lineHeight: fontSize * leading,
    width,
    padX: Math.round(width * 0.08),
    padY: Math.round(fontSize * 0.45),
    bg: search.bg ?? "#121212",
    fg: search.fg ?? "#f2efe6",
    fontFamily: "sans-serif",
  };
}

function pathGroup(paths: string[], fill: string, x: number, y: number, scale: number): string {
  const body = paths.map((d) => `<path d="${d}" fill="${fill}"/>`).join("");
  return `<g transform="translate(${x} ${y}) scale(${scale})">${body}</g>`;
}

async function glyphsFor(slug: string, search: FontSearch, width: number, fontSize: number) {
  const file = await loadFontFile(slug);
  if (!file) return null;
  const copy = Uint8Array.from(file.bytes);
  return outlineGlyphs(copy.buffer, styleFromSearch(search, width, fontSize));
}

function cardSvg(bg: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
<rect width="100%" height="100%" fill="${bg}"/>
${body}
</svg>`;
}

async function singleFaceSvg(slug: string, search: FontSearch): Promise<string | null> {
  const fontSize = Math.min(220, Math.max(72, Math.round((search.size ?? 72) * 1.7)));
  const laid = await glyphsFor(slug, search, OG_WIDTH, fontSize);
  if (!laid) return null;
  const scale = Math.min(OG_WIDTH / laid.width, OG_HEIGHT / laid.height, 1);
  const x = (OG_WIDTH - laid.width * scale) / 2;
  const y = (OG_HEIGHT - laid.height * scale) / 2;
  return cardSvg(laid.bg, pathGroup(laid.paths, laid.fg, x, y, scale));
}

async function collageSvg(search: FontSearch): Promise<string | null> {
  const faces = popularTextFaces(4);
  const cols = 2;
  const rows = 2;
  const cellW = OG_WIDTH / cols;
  const cellH = OG_HEIGHT / rows;
  const cells = await Promise.all(
    faces.map(async (font, i) => {
      const laid = await glyphsFor(font.slug, search, cellW, 72);
      if (!laid) return "";
      const col = i % cols;
      const row = Math.floor(i / cols);
      const scale = Math.min(cellW / laid.width, cellH / laid.height, 1);
      const x = col * cellW + (cellW - laid.width * scale) / 2;
      const y = row * cellH + (cellH - laid.height * scale) / 2;
      return pathGroup(laid.paths, laid.fg, x, y, scale);
    }),
  );
  const body = cells.filter(Boolean).join("");
  if (!body) return null;
  return cardSvg(search.bg ?? "#121212", body);
}

export function compositionCacheKey(slug: string | undefined, search: FontSearch): string {
  return JSON.stringify({
    slug: slug ?? "",
    text: search.text ?? "",
    size: search.size ?? 72,
    fg: search.fg ?? "",
    bg: search.bg ?? "",
    align: search.align ?? "",
    track: search.track ?? 0,
    lead: search.lead ?? 1.15,
    case: search.case ?? "",
  });
}

export async function renderCompositionPng(slug: string | undefined, search: FontSearch): Promise<Uint8Array | null> {
  if (!search.text?.trim()) return null;
  const key = compositionCacheKey(slug, search);
  const hit = cache.get(key);
  if (hit) return hit;
  const svg = slug ? await singleFaceSvg(slug, search) : await collageSvg(search);
  if (!svg) return null;
  const { Resvg } = await import("@resvg/resvg-js");
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
  const bytes = new Uint8Array(png);
  if (cache.size > 40) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, bytes);
  return bytes;
}

export function parseOgRequest(url: URL): { slug?: string; search: FontSearch } {
  const search = parseFontSearch(Object.fromEntries(url.searchParams.entries()));
  const slugParam = url.searchParams.get("slug")?.trim();
  const slug = slugParam && getFont(slugParam) ? slugParam : undefined;
  return { slug, search };
}
