export type FontSearch = {
  text?: string;
  size?: number;
};

const MAX_TEXT = 500;

export function clampPreviewSize(value: number): number {
  return Math.min(160, Math.max(28, Math.round(value)));
}

export function fontPreviewSearch(text: string, size?: number): FontSearch {
  const trimmed = text.trim().slice(0, MAX_TEXT);
  if (!trimmed) return {};
  const search: FontSearch = { text: trimmed };
  if (typeof size === "number" && Number.isFinite(size)) search.size = clampPreviewSize(size);
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
  return out;
}
