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
  fg: string;
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
  return specimenSvg(laid.width, laid.height, laid.bg, laid.fg, laid.paths);
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
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, style.width, height);
  ctx.fillStyle = style.fg;
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

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
