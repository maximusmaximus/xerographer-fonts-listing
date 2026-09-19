import type { CSSProperties } from "react";
import { mixHex } from "./color.ts";
import { applyCase, type Align, type CaseMode } from "./specimen.ts";
import { inkCss, paperBackground, type InkMode, type PaperMode, type TextureId } from "./surfaces.ts";

export type Blend = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "soft-light";
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type AlignTo = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type Box = { x: number; y: number; w: number; h: number };
export type ArtboardGroupId = "standard" | "social" | "banner" | "spatial";
export type Orientation = "landscape" | "portrait" | "square";

export type ArtboardPreset = {
  id: string;
  label: string;
  use: string;
  width: number;
  height: number;
  group: ArtboardGroupId;
};

export type DepthLook = {
  id: string;
  label: string;
  rotateX: number;
  rotateY: number;
  rotation: number;
  translateZ: number;
  extrude: number;
  perspective: number;
  perspectiveX: number;
  perspectiveY: number;
};

export const BLENDS: { id: Blend; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
  { id: "darken", label: "Darken" },
  { id: "lighten", label: "Lighten" },
  { id: "soft-light", label: "Soft light" },
];

export const ARTBOARD_GROUPS: { id: ArtboardGroupId; label: string; hint: string }[] = [
  { id: "standard", label: "Standard", hint: "Print, screen, and everyday boards" },
  { id: "social", label: "Social", hint: "Feed posts, stories, and thumbs" },
  { id: "banner", label: "Banners", hint: "Headers, covers, and heros" },
  { id: "spatial", label: "3D", hint: "Cube faces, panorama, stereo" },
];

export const ARTBOARDS: ArtboardPreset[] = [
  { id: "square", label: "Square", use: "Posts, avatars, album art", width: 1080, height: 1080, group: "standard" },
  { id: "hd", label: "HD 16:9", use: "Video, slides, desktop", width: 1920, height: 1080, group: "standard" },
  { id: "qhd", label: "QHD", use: "High-res 16:9", width: 2560, height: 1440, group: "standard" },
  { id: "portrait", label: "Phone", use: "Full-bleed 9:16", width: 1080, height: 1920, group: "standard" },
  { id: "photo", label: "Photo 4:5", use: "Portrait stills", width: 1080, height: 1350, group: "standard" },
  { id: "classic", label: "Classic 4:3", use: "Stills, documents", width: 1600, height: 1200, group: "standard" },
  { id: "letter", label: "Letter", use: "8.5×11 in at 150 dpi", width: 1275, height: 1650, group: "standard" },
  { id: "poster", label: "Poster", use: "18×24 in at 100 dpi", width: 1800, height: 2400, group: "standard" },
  { id: "ig-post", label: "Instagram post", use: "Feed square", width: 1080, height: 1080, group: "social" },
  { id: "ig-portrait", label: "Instagram portrait", use: "Feed 4:5", width: 1080, height: 1350, group: "social" },
  { id: "story", label: "Story / Reel / TikTok", use: "9:16 vertical video", width: 1080, height: 1920, group: "social" },
  { id: "x-post", label: "X post", use: "Landscape feed image", width: 1600, height: 900, group: "social" },
  { id: "og", label: "Link card", use: "OG, Facebook, LinkedIn", width: 1200, height: 630, group: "social" },
  { id: "yt-thumb", label: "YouTube thumb", use: "Video preview 16:9", width: 1280, height: 720, group: "social" },
  { id: "pin", label: "Pinterest pin", use: "Standard 2:3 pin", width: 1000, height: 1500, group: "social" },
  { id: "li-square", label: "LinkedIn square", use: "Professional feed", width: 1200, height: 1200, group: "social" },
  { id: "x-header", label: "X header", use: "Profile banner 3:1", width: 1500, height: 500, group: "banner" },
  { id: "li-banner", label: "LinkedIn banner", use: "Profile cover 4:1", width: 1584, height: 396, group: "banner" },
  { id: "fb-cover", label: "Facebook cover", use: "Page or profile cover", width: 1640, height: 924, group: "banner" },
  { id: "yt-channel", label: "YouTube channel", use: "Channel art 16:9", width: 2560, height: 1440, group: "banner" },
  { id: "hero", label: "Website hero", use: "Page masthead 3:1", width: 1920, height: 640, group: "banner" },
  { id: "email", label: "Email header", use: "Newsletter top 3:1", width: 1200, height: 400, group: "banner" },
  { id: "billboard", label: "Billboard", use: "Wide display 4:1", width: 1920, height: 480, group: "banner" },
  { id: "cube", label: "Cube face", use: "Skybox, material, icon", width: 1024, height: 1024, group: "spatial" },
  { id: "pano", label: "Panorama", use: "Equirectangular 2:1", width: 2048, height: 1024, group: "spatial" },
  { id: "stereo", label: "Stereo 3D", use: "Side-by-side 16:9", width: 1920, height: 1080, group: "spatial" },
  { id: "env", label: "Environment", use: "Square sphere map", width: 2048, height: 2048, group: "spatial" },
];

export const DEPTH_LOOKS: DepthLook[] = [
  { id: "flat", label: "Flat", rotateX: 0, rotateY: 0, rotation: 0, translateZ: 0, extrude: 0, perspective: 0, perspectiveX: 50, perspectiveY: 50 },
  { id: "tilt-left", label: "Tilt left", rotateX: 6, rotateY: -34, rotation: 0, translateZ: 36, extrude: 0, perspective: 1200, perspectiveX: 48, perspectiveY: 42 },
  { id: "tilt-right", label: "Tilt right", rotateX: 6, rotateY: 34, rotation: 0, translateZ: 36, extrude: 0, perspective: 1200, perspectiveX: 52, perspectiveY: 42 },
  { id: "rise", label: "Rise", rotateX: -32, rotateY: 0, rotation: 0, translateZ: 20, extrude: 0, perspective: 1400, perspectiveX: 50, perspectiveY: 68 },
  { id: "floor", label: "Floor", rotateX: 38, rotateY: 0, rotation: 0, translateZ: 8, extrude: 0, perspective: 1400, perspectiveX: 50, perspectiveY: 18 },
  { id: "iso", label: "Isometric", rotateX: 60, rotateY: 0, rotation: -45, translateZ: 0, extrude: 0, perspective: 0, perspectiveX: 50, perspectiveY: 50 },
  { id: "hero", label: "Hero", rotateX: -16, rotateY: -24, rotation: -4, translateZ: 56, extrude: 10, perspective: 1100, perspectiveX: 42, perspectiveY: 38 },
  { id: "block", label: "Block type", rotateX: -8, rotateY: 16, rotation: 0, translateZ: 12, extrude: 22, perspective: 1600, perspectiveX: 50, perspectiveY: 45 },
];

export const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
export const SNAP_GRID = 8;
export const ARTBOARD_MIN = 320;
export const ARTBOARD_MAX = 4096;

const KNOWN_RATIOS: [number, number, string][] = [
  [1, 1, "1:1"],
  [16, 9, "16:9"],
  [9, 16, "9:16"],
  [4, 5, "4:5"],
  [5, 4, "5:4"],
  [4, 3, "4:3"],
  [3, 4, "3:4"],
  [3, 2, "3:2"],
  [2, 3, "2:3"],
  [3, 1, "3:1"],
  [4, 1, "4:1"],
  [2, 1, "2:1"],
  [21, 9, "21:9"],
  [1.91, 1, "1.91:1"],
];

type LayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  rotation: number;
  opacity: number;
  blend: Blend;
  locked: boolean;
  hidden: boolean;
  flipX: boolean;
  flipY: boolean;
  rotateX: number;
  rotateY: number;
  translateZ: number;
};

export type TextLayer = LayerBase & {
  type: "text";
  text: string;
  fontSize: number;
  tracking: number;
  leading: number;
  align: Align;
  caseMode: CaseMode;
  fill: string;
  fill2: string;
  ink: InkMode;
  angle: number;
  strokeWidth: number;
  strokeColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
  glow: number;
  glowColor: string;
  extrude: number;
};

export type ShapeLayer = LayerBase & {
  type: "rect" | "ellipse";
  h: number;
  fill: string;
  fill2: string;
  paper: PaperMode;
  angle: number;
  strokeWidth: number;
  strokeColor: string;
  radius: number;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
};

export type ImageLayer = LayerBase & {
  type: "image";
  h: number;
  src: string;
  bright: number;
  contrast: number;
  saturate: number;
  blur: number;
  gray: number;
  invert: number;
};

export type Layer = TextLayer | ShapeLayer | ImageLayer;

export type Artboard = {
  width: number;
  height: number;
  bg: string;
  bg2: string;
  paper: PaperMode;
  texture: TextureId;
  angle: number;
  perspective: number;
  perspectiveX: number;
  perspectiveY: number;
};

export type EditorDoc = {
  artboard: Artboard;
  layers: Layer[];
  selectedId: string | null;
};

export function uid(): string {
  return `l${Math.random().toString(36).slice(2, 9)}`;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function formatRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "—";
  const r = width / height;
  for (const [a, b, label] of KNOWN_RATIOS) {
    if (Math.abs(r - a / b) < 0.02) return label;
  }
  const g = gcd(width, height);
  return `${width / g}:${height / g}`;
}

export function artboardOrientation(width: number, height: number): Orientation {
  if (width <= 0 || height <= 0) return "landscape";
  if (Math.abs(width - height) / Math.max(width, height) < 0.02) return "square";
  return width > height ? "landscape" : "portrait";
}

export function clampArtboard(n: number): number {
  if (!Number.isFinite(n)) return ARTBOARD_MIN;
  return Math.min(ARTBOARD_MAX, Math.max(ARTBOARD_MIN, Math.round(n)));
}

export function matchArtboard(width: number, height: number): ArtboardPreset | undefined {
  return ARTBOARDS.find((item) => item.width === width && item.height === height);
}

export function presetsInGroup(group: ArtboardGroupId): ArtboardPreset[] {
  return ARTBOARDS.filter((item) => item.group === group);
}

function depthDefaults(): Pick<LayerBase, "rotateX" | "rotateY" | "translateZ"> {
  return { rotateX: 0, rotateY: 0, translateZ: 0 };
}

export function defaultTextLayer(text: string, artboard: Artboard, fill = "#f2efe6"): TextLayer {
  return {
    id: uid(),
    type: "text",
    name: "Type",
    x: Math.round(artboard.width * 0.08),
    y: Math.round(artboard.height * 0.32),
    w: Math.round(artboard.width * 0.84),
    rotation: 0,
    opacity: 1,
    blend: "normal",
    locked: false,
    hidden: false,
    flipX: false,
    flipY: false,
    ...depthDefaults(),
    text,
    fontSize: Math.round(Math.min(120, artboard.width / 9)),
    tracking: 0,
    leading: 1.1,
    align: "left",
    caseMode: "none",
    fill,
    fill2: "#cfc6b4",
    ink: "solid",
    angle: 160,
    strokeWidth: 0,
    strokeColor: "#000000",
    shadowX: 0,
    shadowY: 0,
    shadowBlur: 0,
    shadowColor: "#000000",
    glow: 0,
    glowColor: "#ffffff",
    extrude: 0,
  };
}

export function defaultShape(kind: "rect" | "ellipse", artboard: Artboard): ShapeLayer {
  const w = Math.round(artboard.width * 0.4);
  const h = Math.round(artboard.height * 0.22);
  return {
    id: uid(),
    type: kind,
    name: kind === "rect" ? "Rectangle" : "Ellipse",
    x: Math.round((artboard.width - w) / 2),
    y: Math.round((artboard.height - h) / 2),
    w,
    h,
    rotation: 0,
    opacity: 1,
    blend: "normal",
    locked: false,
    hidden: false,
    flipX: false,
    flipY: false,
    ...depthDefaults(),
    fill: "#d7d2c8",
    fill2: "#6b665c",
    paper: "solid",
    angle: 135,
    strokeWidth: 0,
    strokeColor: "#000000",
    radius: kind === "rect" ? 16 : 999,
    shadowX: 0,
    shadowY: 0,
    shadowBlur: 0,
    shadowColor: "#000000",
  };
}

export function defaultImageLayer(
  src: string,
  name: string,
  artboard: Artboard,
  natural?: { w: number; h: number },
): ImageLayer {
  const maxW = artboard.width * 0.82;
  const maxH = artboard.height * 0.62;
  const nw = natural?.w || 1200;
  const nh = natural?.h || 800;
  const s = Math.min(maxW / nw, maxH / nh, 1);
  const w = Math.round(nw * s);
  const h = Math.round(nh * s);
  return {
    id: uid(),
    type: "image",
    name,
    x: Math.round((artboard.width - w) / 2),
    y: Math.round((artboard.height - h) / 2),
    w,
    h,
    rotation: 0,
    opacity: 1,
    blend: "normal",
    locked: false,
    hidden: false,
    flipX: false,
    flipY: false,
    ...depthDefaults(),
    src,
    bright: 1,
    contrast: 1,
    saturate: 1,
    blur: 0,
    gray: 0,
    invert: 0,
  };
}

export function selectedLayer(doc: EditorDoc): Layer | undefined {
  return doc.layers.find((layer) => layer.id === doc.selectedId);
}

export function patchLayer(doc: EditorDoc, id: string, patch: Partial<Layer>): EditorDoc {
  return {
    ...doc,
    layers: doc.layers.map((layer) => (layer.id === id ? ({ ...layer, ...patch } as Layer) : layer)),
  };
}

export function displayText(layer: TextLayer): string {
  return applyCase(layer.text, layer.caseMode) || "Type something";
}

export function layerBox(layer: Layer): Box {
  if (layer.type === "text") {
    const lines = Math.max(1, displayText(layer).split("\n").length);
    return { x: layer.x, y: layer.y, w: layer.w, h: Math.round(layer.fontSize * layer.leading * lines) };
  }
  return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
}

export function layerCenter(layer: Layer): { x: number; y: number } {
  const box = layerBox(layer);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

export function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number): { x: number; y: number } {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

export function snapValue(n: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return Math.round(n);
  return Math.round(n / grid) * grid;
}

export function applyHandleResize(
  start: Box,
  handle: Handle,
  dx: number,
  dy: number,
  keepAspect: boolean,
): Box {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;
  const min = 12;
  if (right - left < min) {
    if (handle.includes("w")) left = right - min;
    else right = left + min;
  }
  if (bottom - top < min) {
    if (handle.includes("n")) top = bottom - min;
    else bottom = top + min;
  }
  if (keepAspect && start.h > 0) {
    const ratio = start.w / start.h;
    let w = right - left;
    let h = bottom - top;
    if (handle === "n" || handle === "s") {
      w = h * ratio;
      const cx = start.x + start.w / 2;
      left = cx - w / 2;
      right = cx + w / 2;
    } else if (handle === "e" || handle === "w") {
      h = w / ratio;
      const cy = start.y + start.h / 2;
      top = cy - h / 2;
      bottom = cy + h / 2;
    } else {
      h = w / ratio;
      if (handle.includes("n")) top = bottom - h;
      else bottom = top + h;
    }
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function resizeLayer(layer: Layer, next: Box): Partial<Layer> {
  if (layer.type === "text") {
    const lines = Math.max(1, displayText(layer).split("\n").length);
    const fontSize = Math.max(10, Math.round(next.h / (layer.leading * lines)));
    return { x: Math.round(next.x), y: Math.round(next.y), w: Math.round(next.w), fontSize };
  }
  return { x: Math.round(next.x), y: Math.round(next.y), w: Math.round(next.w), h: Math.round(next.h) };
}

export function alignLayer(layer: Layer, artboard: Artboard, where: AlignTo): Partial<Layer> {
  const box = layerBox(layer);
  switch (where) {
    case "left":
      return { x: 0 };
    case "center":
      return { x: Math.round((artboard.width - box.w) / 2) };
    case "right":
      return { x: Math.round(artboard.width - box.w) };
    case "top":
      return { y: 0 };
    case "middle":
      return { y: Math.round((artboard.height - box.h) / 2) };
    case "bottom":
      return { y: Math.round(artboard.height - box.h) };
  }
}

export function nudge(layer: Layer, dx: number, dy: number): Partial<Layer> {
  return { x: layer.x + dx, y: layer.y + dy };
}

export function handleCursor(handle: Handle, rotation: number): string {
  const map: Record<Handle, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
  const angle = ((map[handle] + rotation) % 180 + 180) % 180;
  if (angle < 22.5 || angle >= 157.5) return "ew-resize";
  if (angle < 67.5) return "nwse-resize";
  if (angle < 112.5) return "ns-resize";
  return "nesw-resize";
}

export function handleStyle(handle: Handle, box: Box, size: number): CSSProperties {
  const midX = box.w / 2 - size / 2;
  const midY = box.h / 2 - size / 2;
  const pos: Record<Handle, CSSProperties> = {
    nw: { left: -size / 2, top: -size / 2 },
    n: { left: midX, top: -size / 2 },
    ne: { right: -size / 2, top: -size / 2 },
    e: { right: -size / 2, top: midY },
    se: { right: -size / 2, bottom: -size / 2 },
    s: { left: midX, bottom: -size / 2 },
    sw: { left: -size / 2, bottom: -size / 2 },
    w: { left: -size / 2, top: midY },
  };
  return { width: size, height: size, ...pos[handle] };
}

export function imageFilter(layer: ImageLayer): string {
  return [
    `brightness(${layer.bright})`,
    `contrast(${layer.contrast})`,
    `saturate(${layer.saturate})`,
    `blur(${layer.blur}px)`,
    `grayscale(${layer.gray})`,
    `invert(${layer.invert})`,
  ].join(" ");
}

export function layerTransform(layer: Layer, withFlip = true): string {
  const flipX = withFlip && layer.flipX ? -1 : 1;
  const flipY = withFlip && layer.flipY ? -1 : 1;
  return [
    `translateZ(${layer.translateZ}px)`,
    `rotateX(${layer.rotateX}deg)`,
    `rotateY(${layer.rotateY}deg)`,
    `rotateZ(${layer.rotation}deg)`,
    `scaleX(${flipX})`,
    `scaleY(${flipY})`,
  ].join(" ");
}

export function extrusionShadows(layer: TextLayer): string {
  if (layer.extrude <= 0) return "";
  const steps = Math.min(40, Math.max(1, Math.round(layer.extrude)));
  const rx = (layer.rotateX * Math.PI) / 180;
  const ry = (layer.rotateY * Math.PI) / 180;
  const parts: string[] = [];
  for (let i = steps; i >= 1; i -= 1) {
    const dx = Math.sin(ry) * i + i * 0.22;
    const dy = -Math.sin(rx) * i + i * 0.55;
    const shade = mixHex(layer.fill, "#050505", 0.32 + (i / steps) * 0.48);
    parts.push(`${dx.toFixed(1)}px ${dy.toFixed(1)}px 0 ${shade}`);
  }
  return parts.join(", ");
}

export function layerCss(layer: Layer, fontFamily: string): CSSProperties {
  const box = layerBox(layer);
  const common: CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.w,
    opacity: layer.opacity,
    mixBlendMode: layer.blend as CSSProperties["mixBlendMode"],
    transform: layerTransform(layer),
    transformOrigin: "center center",
    transformStyle: "preserve-3d",
    pointerEvents: layer.locked || layer.hidden ? "none" : "auto",
    visibility: layer.hidden ? "hidden" : "visible",
  };
  if (layer.type === "text") {
    const fill = inkCss(layer.fill, layer.fill2, layer.ink, layer.angle);
    const shadows = [
      layer.shadowBlur > 0 || layer.shadowX || layer.shadowY
        ? `${layer.shadowX}px ${layer.shadowY}px ${layer.shadowBlur}px ${layer.shadowColor}`
        : "",
      layer.glow > 0 ? `0 0 ${layer.glow}px ${layer.glowColor}` : "",
      extrusionShadows(layer),
    ]
      .filter(Boolean)
      .join(", ");
    return {
      ...common,
      minHeight: box.h,
      fontFamily,
      fontSize: layer.fontSize,
      lineHeight: layer.leading,
      letterSpacing: `${layer.tracking}em`,
      textAlign: layer.align,
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      WebkitTextStroke: layer.strokeWidth > 0 ? `${layer.strokeWidth}px ${layer.strokeColor}` : undefined,
      textShadow: shadows || undefined,
      ...fill,
    };
  }
  if (layer.type === "image") {
    return {
      ...common,
      height: layer.h,
      objectFit: "cover",
      filter: imageFilter(layer),
    };
  }
  const bg = paperBackground(layer.fill, layer.fill2, layer.paper, layer.angle, "none");
  const shadow =
    layer.shadowBlur > 0 || layer.shadowX || layer.shadowY
      ? `${layer.shadowX}px ${layer.shadowY}px ${layer.shadowBlur}px ${layer.shadowColor}`
      : undefined;
  return {
    ...common,
    height: layer.h,
    borderRadius: layer.type === "ellipse" ? "999px" : layer.radius,
    border: layer.strokeWidth > 0 ? `${layer.strokeWidth}px solid ${layer.strokeColor}` : undefined,
    boxShadow: shadow,
    ...bg,
  };
}

export function artboardStyle(artboard: Artboard): CSSProperties {
  return {
    width: artboard.width,
    height: artboard.height,
    transformStyle: "preserve-3d",
    ...paperBackground(artboard.bg, artboard.bg2, artboard.paper, artboard.angle, artboard.texture),
  };
}

export function artboardSceneStyle(artboard: Artboard, scale: number): CSSProperties {
  return {
    perspective: artboard.perspective > 0 ? `${artboard.perspective * scale}px` : undefined,
    perspectiveOrigin: `${artboard.perspectiveX}% ${artboard.perspectiveY}%`,
  };
}

export function cloneLayer(layer: Layer, offset = 24): Layer {
  return { ...layer, id: uid(), name: `${layer.name} copy`, x: layer.x + offset, y: layer.y + offset };
}

export function canvasBlend(blend: Blend): GlobalCompositeOperation {
  if (blend === "normal") return "source-over";
  if (blend === "soft-light") return "soft-light";
  return blend;
}

export function scaleLayers(layers: Layer[], from: Artboard, width: number, height: number): Layer[] {
  const sx = width / Math.max(1, from.width);
  const sy = height / Math.max(1, from.height);
  const s = Math.min(sx, sy);
  const ox = (width - from.width * s) / 2;
  const oy = (height - from.height * s) / 2;
  return layers.map((layer) => {
    const next = {
      ...layer,
      x: Math.round(layer.x * s + ox),
      y: Math.round(layer.y * s + oy),
      w: Math.max(8, Math.round(layer.w * s)),
      translateZ: Math.round(layer.translateZ * s),
    };
    if (layer.type === "text") {
      return {
        ...next,
        fontSize: Math.max(10, Math.round(layer.fontSize * s)),
        extrude: Math.round(layer.extrude * s),
      };
    }
    return { ...next, h: Math.max(8, Math.round(layer.h * s)) };
  });
}

export function applyDepthLook(layer: Layer, look: DepthLook): Partial<Layer> {
  const patch: Partial<Layer> = {
    rotateX: look.rotateX,
    rotateY: look.rotateY,
    rotation: look.rotation,
    translateZ: look.translateZ,
  };
  if (layer.type === "text") {
    return { ...patch, extrude: look.extrude };
  }
  return patch;
}

export function hasDepth(layer: Layer): boolean {
  return Boolean(layer.rotateX || layer.rotateY || layer.translateZ || (layer.type === "text" && layer.extrude));
}
