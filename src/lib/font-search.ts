import type { Align, CaseMode } from "./specimen.ts";
import type { InkMode, PaperMode, TextureId } from "./surfaces.ts";

export type FontSearch = {
  text?: string;
  size?: number;
  fg?: string;
  bg?: string;
  fg2?: string;
  bg2?: string;
  align?: Align;
  track?: number;
  lead?: number;
  case?: CaseMode;
  paper?: PaperMode;
  ink?: InkMode;
  tx?: TextureId;
  ang?: number;
};

const MAX_TEXT = 500;
const ALIGNS = new Set<Align>(["left", "center", "right", "justify"]);
const CASES = new Set<CaseMode>(["none", "upper", "lower"]);
const PAPERS = new Set<PaperMode>(["solid", "linear", "radial"]);
const INKS = new Set<InkMode>(["solid", "linear", "radial"]);
const TEXTURES = new Set<TextureId>(["none", "grain", "paper", "halftone", "linen", "grid", "carbon", "film"]);

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
  const fg2 = parseHexColor(input.fg2);
  const bg2 = parseHexColor(input.bg2);
  if (fg) out.fg = fg;
  if (bg) out.bg = bg;
  if (fg2) out.fg2 = fg2;
  if (bg2) out.bg2 = bg2;
  if (input.align && ALIGNS.has(input.align) && input.align !== "left") out.align = input.align;
  if (typeof input.track === "number" && Number.isFinite(input.track) && input.track !== 0) {
    out.track = Math.min(0.28, Math.max(-0.08, round(input.track, 2)));
  }
  if (typeof input.lead === "number" && Number.isFinite(input.lead) && Math.abs(input.lead - 1.15) > 0.001) {
    out.lead = Math.min(2, Math.max(0.9, round(input.lead, 2)));
  }
  if (input.case && CASES.has(input.case) && input.case !== "none") out.case = input.case;
  if (input.paper && PAPERS.has(input.paper) && input.paper !== "solid") out.paper = input.paper;
  if (input.ink && INKS.has(input.ink) && input.ink !== "solid") out.ink = input.ink;
  if (input.tx && TEXTURES.has(input.tx) && input.tx !== "none") out.tx = input.tx;
  if (typeof input.ang === "number" && Number.isFinite(input.ang) && input.ang !== 160) {
    out.ang = ((Math.round(input.ang) % 360) + 360) % 360;
  }
  return out;
}

export function parseFontSearch(search: Record<string, unknown>): FontSearch {
  const rawText = typeof search.text === "string" ? search.text.trim().slice(0, MAX_TEXT) : "";
  const parsedSize = parseNumber(search.size);
  const track = parseNumber(search.track);
  const lead = parseNumber(search.lead);
  const ang = parseNumber(search.ang);
  const align = typeof search.align === "string" && ALIGNS.has(search.align as Align) ? (search.align as Align) : undefined;
  const caseMode = typeof search.case === "string" && CASES.has(search.case as CaseMode) ? (search.case as CaseMode) : undefined;
  const paper = typeof search.paper === "string" && PAPERS.has(search.paper as PaperMode) ? (search.paper as PaperMode) : undefined;
  const ink = typeof search.ink === "string" && INKS.has(search.ink as InkMode) ? (search.ink as InkMode) : undefined;
  const tx = typeof search.tx === "string" && TEXTURES.has(search.tx as TextureId) ? (search.tx as TextureId) : undefined;
  return serializeComposition({
    text: rawText,
    size: Number.isFinite(parsedSize) ? parsedSize : undefined,
    fg: parseHexColor(search.fg),
    bg: parseHexColor(search.bg),
    fg2: parseHexColor(search.fg2),
    bg2: parseHexColor(search.bg2),
    align,
    track: Number.isFinite(track) ? track : undefined,
    lead: Number.isFinite(lead) ? lead : undefined,
    case: caseMode,
    paper,
    ink,
    tx,
    ang: Number.isFinite(ang) ? ang : undefined,
  });
}

export function compositionHref(pathname: string, composition: FontSearch, origin = ""): string {
  const serialized = serializeComposition(composition);
  const params = compositionParams(serialized);
  const query = params.toString();
  const path = query ? `${pathname}?${query}` : pathname;
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return base ? `${base}${path}` : path;
}

function compositionParams(serialized: FontSearch): URLSearchParams {
  const params = new URLSearchParams();
  if (serialized.text) params.set("text", serialized.text);
  if (serialized.size != null) params.set("size", String(serialized.size));
  if (serialized.fg) params.set("fg", serialized.fg);
  if (serialized.bg) params.set("bg", serialized.bg);
  if (serialized.fg2) params.set("fg2", serialized.fg2);
  if (serialized.bg2) params.set("bg2", serialized.bg2);
  if (serialized.align) params.set("align", serialized.align);
  if (serialized.track != null) params.set("track", String(serialized.track));
  if (serialized.lead != null) params.set("lead", String(serialized.lead));
  if (serialized.case) params.set("case", serialized.case);
  if (serialized.paper) params.set("paper", serialized.paper);
  if (serialized.ink) params.set("ink", serialized.ink);
  if (serialized.tx) params.set("tx", serialized.tx);
  if (serialized.ang != null) params.set("ang", String(serialized.ang));
  return params;
}

export function compositionOgPath(pathname: string, composition: FontSearch): string {
  const serialized = serializeComposition(composition);
  if (!serialized.text) return "";
  const params = compositionParams(serialized);
  const slug = pathname.match(/^\/font\/([^/?#]+)/)?.[1];
  if (slug) params.set("slug", decodeURIComponent(slug));
  return `/api/og-composition?${params.toString()}`;
}

export function compositionOgHref(pathname: string, composition: FontSearch, origin = ""): string {
  const path = compositionOgPath(pathname, composition);
  if (!path) return "";
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return base ? `${base}${path}` : path;
}
