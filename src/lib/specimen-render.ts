import * as OpenType from "opentype.js";
import {
  applyCase,
  lineOriginX,
  shouldJustify,
  specimenSvg,
  wordGap,
  wrapLines,
  type Align,
  type CaseMode,
} from "./specimen.ts";
import type { InkMode, PaperMode, TextureId } from "./surfaces.ts";

type Font = OpenType.Font;
const parse: typeof OpenType.parse =
  typeof OpenType.parse === "function"
    ? OpenType.parse
    : (OpenType as unknown as { default: { parse: typeof OpenType.parse } }).default.parse;

export type SpecimenStyle = {
  text: string;
  caseMode: CaseMode;
  align: Align;
  fontSize: number;
  trackingPx: number;
  lineHeight: number;
  width: number;
  padX: number;
  padY: number;
  bg: string;
  bg2?: string;
  fg: string;
  fg2?: string;
  paper?: PaperMode;
  ink?: InkMode;
  texture?: TextureId;
  angle?: number;
  fontFamily: string;
};

function measureWithFont(font: Font, fontSize: number, trackingPx: number) {
  const scale = fontSize / font.unitsPerEm;
  return (text: string) => {
    if (!text) return 0;
    let width = 0;
    for (let i = 0; i < text.length; i += 1) {
      width += font.charToGlyph(text[i]!).advanceWidth * scale;
      if (i < text.length - 1) width += trackingPx;
    }
    return width;
  };
}

function pathsForString(
  font: Font,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  trackingPx: number,
): { paths: string[]; width: number } {
  const scale = fontSize / font.unitsPerEm;
  const paths: string[] = [];
  let cursor = x;
  for (let i = 0; i < text.length; i += 1) {
    const glyph = font.charToGlyph(text[i]!);
    const d = glyph.getPath(cursor, y, fontSize).toPathData(2);
    if (d) paths.push(d);
    cursor += glyph.advanceWidth * scale;
    if (i < text.length - 1) cursor += trackingPx;
  }
  return { paths, width: cursor - x };
}

export function outlineGlyphs(
  buffer: ArrayBuffer,
  style: SpecimenStyle,
): { width: number; height: number; paths: string[]; bg: string; fg: string } {
  const font = parse(buffer);
  const display = applyCase(style.text, style.caseMode) || " ";
  const measure = measureWithFont(font, style.fontSize, style.trackingPx);
  const box = Math.max(style.width - style.padX * 2, 1);
  const lines = wrapLines(display, box, measure);
  const ascent = (font.ascender / font.unitsPerEm) * style.fontSize;
  const paths: string[] = [];
  let y = style.padY + ascent;
  for (const line of lines) {
    if (line.text) {
      if (shouldJustify(style.align, line)) {
        const words = line.text.split(/\s+/);
        const gap = wordGap(words, box, measure);
        let x = style.padX;
        for (const word of words) {
          const piece = pathsForString(font, word, x, y, style.fontSize, style.trackingPx);
          paths.push(...piece.paths);
          x += piece.width + gap;
        }
      } else {
        const width = measure(line.text);
        const x = style.padX + lineOriginX(style.align, width, box);
        paths.push(...pathsForString(font, line.text, x, y, style.fontSize, style.trackingPx).paths);
      }
    }
    y += style.lineHeight;
  }
  const height = Math.max(
    y + Math.abs(font.descender / font.unitsPerEm) * style.fontSize + style.padY,
    style.padY * 2 + style.lineHeight,
  );
  return { width: style.width, height, paths, bg: style.bg, fg: style.fg };
}

export function outlineSpecimen(buffer: ArrayBuffer, style: SpecimenStyle): string {
  const laid = outlineGlyphs(buffer, style);
  const angle = style.angle ?? 160;
  const paper = style.paper ?? "solid";
  const ink = style.ink ?? "solid";
  const bg2 = style.bg2 ?? style.bg;
  const fg2 = style.fg2 ?? style.fg;
  const defs: string[] = [];
  let paperFill = laid.bg;
  let inkFill = laid.fg;
  if (paper === "linear") {
    defs.push(svgLinear("paper", angle, laid.bg, bg2));
    paperFill = "url(#paper)";
  } else if (paper === "radial") {
    defs.push(`<radialGradient id="paper" cx="28%" cy="22%"><stop offset="0" stop-color="${bg2}"/><stop offset="1" stop-color="${laid.bg}"/></radialGradient>`);
    paperFill = "url(#paper)";
  }
  if (ink === "linear") {
    defs.push(svgLinear("ink", angle, laid.fg, fg2));
    inkFill = "url(#ink)";
  } else if (ink === "radial") {
    defs.push(`<radialGradient id="ink" cx="30%" cy="20%"><stop offset="0" stop-color="${fg2}"/><stop offset="1" stop-color="${laid.fg}"/></radialGradient>`);
    inkFill = "url(#ink)";
  }
  return specimenSvg(laid.width, laid.height, paperFill, inkFill, laid.paths, defs.join(""));
}

function svgLinear(id: string, angle: number, a: string, b: string): string {
  const rad = (angle * Math.PI) / 180;
  const x1 = 50 - Math.cos(rad) * 50;
  const y1 = 50 - Math.sin(rad) * 50;
  const x2 = 50 + Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;
  return `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, trackingPx: number) {
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${trackingPx}px`;
  }
}

export async function rasterizeSpecimen(style: SpecimenStyle): Promise<Blob> {
  await document.fonts.ready;
  const display = applyCase(style.text, style.caseMode) || " ";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const scale = Math.max(3, 2400 / Math.max(style.width, 1));
  ctx.font = `${style.fontSize}px ${style.fontFamily}`;
  setLetterSpacing(ctx, style.trackingPx);
  const measure = (value: string) => ctx.measureText(value).width;
  const box = Math.max(style.width - style.padX * 2, 1);
  const lines = wrapLines(display, box, measure);
  const height = Math.max(
    style.padY * 2 + Math.max(1, lines.length) * style.lineHeight,
    style.padY * 2 + style.lineHeight,
  );
  canvas.width = Math.max(1, Math.round(style.width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  fillPaper(ctx, style, style.width, height);
  const ink = inkFill(ctx, style, style.width, height);
  ctx.fillStyle = ink;
  ctx.font = `${style.fontSize}px ${style.fontFamily}`;
  setLetterSpacing(ctx, style.trackingPx);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let y = style.padY + style.fontSize * 0.8;
  for (const line of lines) {
    if (line.text) {
      if (shouldJustify(style.align, line)) {
        const words = line.text.split(/\s+/);
        const gap = wordGap(words, box, measure);
        let x = style.padX;
        for (const word of words) {
          ctx.fillText(word, x, y);
          x += measure(word) + gap;
        }
      } else {
        const width = measure(line.text);
        const x = style.padX + lineOriginX(style.align, width, box);
        ctx.fillText(line.text, x, y);
      }
    }
    y += style.lineHeight;
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
  if (!blob) throw new Error("Could not encode JPEG");
  return blob;
}

function fillPaper(ctx: CanvasRenderingContext2D, style: SpecimenStyle, width: number, height: number) {
  const paper = style.paper ?? "solid";
  const bg2 = style.bg2 ?? style.bg;
  const angle = style.angle ?? 160;
  if (paper === "linear") {
    const g = linearGradient(ctx, angle, width, height);
    g.addColorStop(0, style.bg);
    g.addColorStop(1, bg2);
    ctx.fillStyle = g;
  } else if (paper === "radial") {
    const g = ctx.createRadialGradient(width * 0.28, height * 0.22, 8, width * 0.4, height * 0.4, Math.max(width, height));
    g.addColorStop(0, bg2);
    g.addColorStop(1, style.bg);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = style.bg;
  }
  ctx.fillRect(0, 0, width, height);
  const tex = style.texture ?? "none";
  if (tex === "none") return;
  ctx.save();
  ctx.globalAlpha = 0.18;
  if (tex === "halftone") {
    ctx.fillStyle = "#000";
    for (let y = 0; y < height; y += 7) {
      for (let x = 0; x < width; x += 7) ctx.fillRect(x, y, 1.2, 1.2);
    }
  } else if (tex === "grid") {
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  } else if (tex === "carbon") {
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    for (let i = -height; i < width; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }
  } else {
    const noise = ctx.createImageData(64, 64);
    for (let i = 0; i < noise.data.length; i += 4) {
      const n = Math.random() * 255;
      noise.data[i] = n;
      noise.data[i + 1] = n;
      noise.data[i + 2] = n;
      noise.data[i + 3] = 90;
    }
    const tile = document.createElement("canvas");
    tile.width = 64;
    tile.height = 64;
    tile.getContext("2d")?.putImageData(noise, 0, 0);
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  }
  ctx.restore();
}

function inkFill(ctx: CanvasRenderingContext2D, style: SpecimenStyle, width: number, height: number): CanvasGradient | string {
  const ink = style.ink ?? "solid";
  const fg2 = style.fg2 ?? style.fg;
  const angle = style.angle ?? 160;
  if (ink === "linear") {
    const g = linearGradient(ctx, angle, width, height);
    g.addColorStop(0, style.fg);
    g.addColorStop(1, fg2);
    return g;
  }
  if (ink === "radial") {
    const g = ctx.createRadialGradient(width * 0.3, height * 0.2, 4, width * 0.45, height * 0.45, Math.max(width, height) * 0.7);
    g.addColorStop(0, fg2);
    g.addColorStop(1, style.fg);
    return g;
  }
  return style.fg;
}

function linearGradient(ctx: CanvasRenderingContext2D, angle: number, width: number, height: number) {
  const rad = (angle * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.hypot(width, height) / 2;
  return ctx.createLinearGradient(cx - Math.cos(rad) * len, cy - Math.sin(rad) * len, cx + Math.cos(rad) * len, cy + Math.sin(rad) * len);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
