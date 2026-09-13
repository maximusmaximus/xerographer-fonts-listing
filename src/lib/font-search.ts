import type { Align, CaseMode } from "./specimen.ts";

export type FontSearch = {
  text?: string;
  size?: number;
  fg?: string;
  bg?: string;
  align?: Align;
  track?: number;
  lead?: number;
  case?: CaseMode;
};

const MAX_TEXT = 500;
const ALIGNS = new Set<Align>(["left", "center", "right", "justify"]);
const CASES = new Set<CaseMode>(["none", "upper", "lower"]);

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

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
}

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

export function fontPreviewSearch(
  text: string,
  size?: number,
  fg?: string,
  bg?: string,
): FontSearch {
  return serializeComposition({ text, size, fg, bg });
}

export function serializeComposition(input: FontSearch): FontSearch {
  const out: FontSearch = {};
  const trimmed = input.text?.trim().slice(0, MAX_TEXT);
  if (!trimmed) return out;
  out.text = trimmed;
  if (typeof input.size === "number" && Number.isFinite(input.size)) out.size = clampPreviewSize(input.size);
  const fg = parseHexColor(input.fg);
  const bg = parseHexColor(input.bg);
  if (fg) out.fg = fg;
  if (bg) out.bg = bg;
  if (input.align && ALIGNS.has(input.align) && input.align !== "left") out.align = input.align;
  if (typeof input.track === "number" && Number.isFinite(input.track) && input.track !== 0) {
    out.track = Math.min(0.28, Math.max(-0.08, round(input.track, 2)));
  }
  if (typeof input.lead === "number" && Number.isFinite(input.lead) && Math.abs(input.lead - 1.15) > 0.001) {
    out.lead = Math.min(2, Math.max(0.9, round(input.lead, 2)));
  }
  if (input.case && CASES.has(input.case) && input.case !== "none") out.case = input.case;
  return out;
}

export function parseFontSearch(search: Record<string, unknown>): FontSearch {
  const rawText = typeof search.text === "string" ? search.text.trim().slice(0, MAX_TEXT) : "";
  const parsedSize = parseNumber(search.size);
  const track = parseNumber(search.track);
  const lead = parseNumber(search.lead);
  const align = typeof search.align === "string" && ALIGNS.has(search.align as Align) ? (search.align as Align) : undefined;
  const caseMode = typeof search.case === "string" && CASES.has(search.case as CaseMode) ? (search.case as CaseMode) : undefined;
  return serializeComposition({
    text: rawText,
    size: Number.isFinite(parsedSize) ? parsedSize : undefined,
    fg: parseHexColor(search.fg),
    bg: parseHexColor(search.bg),
    align,
    track: Number.isFinite(track) ? track : undefined,
    lead: Number.isFinite(lead) ? lead : undefined,
    case: caseMode,
  });
}

export function compositionHref(pathname: string, composition: FontSearch, origin = ""): string {
  const serialized = serializeComposition(composition);
  const params = new URLSearchParams();
  if (serialized.text) params.set("text", serialized.text);
  if (serialized.size != null) params.set("size", String(serialized.size));
  if (serialized.fg) params.set("fg", serialized.fg);
  if (serialized.bg) params.set("bg", serialized.bg);
  if (serialized.align) params.set("align", serialized.align);
  if (serialized.track != null) params.set("track", String(serialized.track));
  if (serialized.lead != null) params.set("lead", String(serialized.lead));
  if (serialized.case) params.set("case", serialized.case);
  const query = params.toString();
  const path = query ? `${pathname}?${query}` : pathname;
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return base ? `${base}${path}` : path;
}
