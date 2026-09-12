export type FontSearch = {
  text?: string;
  size?: number;
  fg?: string;
  bg?: string;
};

const MAX_TEXT = 500;

export function clampPreviewSize(value: number): number {
  return Math.min(160, Math.max(28, Math.round(value)));
}

export function parseHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  return undefined;
}

export function fontPreviewSearch(
  text: string,
  size?: number,
  fg?: string,
  bg?: string,
): FontSearch {
  const trimmed = text.trim().slice(0, MAX_TEXT);
  if (!trimmed) return {};
  const search: FontSearch = { text: trimmed };
  if (typeof size === "number" && Number.isFinite(size)) search.size = clampPreviewSize(size);
  const fgHex = parseHexColor(fg);
  const bgHex = parseHexColor(bg);
  if (fgHex) search.fg = fgHex;
  if (bgHex) search.bg = bgHex;
  return search;
}

export function parseFontSearch(search: Record<string, unknown>): FontSearch {
  const rawText = typeof search.text === "string" ? search.text.trim().slice(0, MAX_TEXT) : "";
  const rawSize = search.size;
  const parsedSize =
    typeof rawSize === "number"
      ? rawSize
      : typeof rawSize === "string" && rawSize.trim()
        ? Number(rawSize)
        : NaN;
  const out: FontSearch = {};
  if (rawText) out.text = rawText;
  if (Number.isFinite(parsedSize)) out.size = clampPreviewSize(parsedSize);
  const fg = parseHexColor(search.fg);
  const bg = parseHexColor(search.bg);
  if (fg) out.fg = fg;
  if (bg) out.bg = bg;
  return out;
}
