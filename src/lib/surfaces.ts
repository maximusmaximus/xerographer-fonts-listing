export type PaperMode = "solid" | "linear" | "radial";
export type InkMode = "solid" | "linear" | "radial";
export type TextureId = "none" | "grain" | "paper" | "halftone" | "linen" | "grid" | "carbon" | "film";

export const PAPER_MODES: { id: PaperMode; label: string }[] = [
  { id: "solid", label: "Flat" },
  { id: "linear", label: "Wash" },
  { id: "radial", label: "Bloom" },
];

export const INK_MODES: { id: InkMode; label: string }[] = [
  { id: "solid", label: "Flat" },
  { id: "linear", label: "Fade" },
  { id: "radial", label: "Glow" },
];

export const TEXTURES: { id: TextureId; label: string }[] = [
  { id: "none", label: "Plain" },
  { id: "grain", label: "Grain" },
  { id: "paper", label: "Tooth" },
  { id: "halftone", label: "Dot" },
  { id: "linen", label: "Linen" },
  { id: "grid", label: "Grid" },
  { id: "carbon", label: "Carbon" },
  { id: "film", label: "Film" },
];

export type Atmosphere = {
  id: string;
  name: string;
  bg: string;
  bg2: string;
  fg: string;
  fg2: string;
  paper: PaperMode;
  ink: InkMode;
  texture: TextureId;
  angle: number;
};

export const ATMOSPHERES: Atmosphere[] = [
  {
    id: "foundry",
    name: "Foundry",
    bg: "#121212",
    bg2: "#2a2722",
    fg: "#f2efe6",
    fg2: "#cfc6b4",
    paper: "solid",
    ink: "solid",
    texture: "grain",
    angle: 160,
  },
  {
    id: "newsprint",
    name: "Newsprint",
    bg: "#e6dcc6",
    bg2: "#cfc3a6",
    fg: "#1c1814",
    fg2: "#4a3f32",
    paper: "solid",
    ink: "solid",
    texture: "paper",
    angle: 180,
  },
  {
    id: "sunset",
    name: "Sunset",
    bg: "#1c1024",
    bg2: "#d2652d",
    fg: "#ffe7c2",
    fg2: "#ff8a5b",
    paper: "linear",
    ink: "linear",
    texture: "film",
    angle: 155,
  },
  {
    id: "neon",
    name: "Neon",
    bg: "#07070c",
    bg2: "#14261c",
    fg: "#5cff9d",
    fg2: "#6ae0ff",
    paper: "radial",
    ink: "linear",
    texture: "none",
    angle: 120,
  },
  {
    id: "blueprint",
    name: "Blueprint",
    bg: "#143a6b",
    bg2: "#0d2748",
    fg: "#e7f1ff",
    fg2: "#9ec4f0",
    paper: "solid",
    ink: "solid",
    texture: "grid",
    angle: 180,
  },
  {
    id: "gilt",
    name: "Gilt",
    bg: "#14110e",
    bg2: "#2b2114",
    fg: "#e8c872",
    fg2: "#fff1c2",
    paper: "radial",
    ink: "linear",
    texture: "carbon",
    angle: 70,
  },
];

export function textureLayer(id: TextureId): string {
  switch (id) {
    case "grain":
      return "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.45'/></svg>\")";
    case "paper":
      return "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.35'/></svg>\"), repeating-linear-gradient(0deg, rgba(80,50,20,.05) 0 1px, transparent 1px 4px)";
    case "halftone":
      return "radial-gradient(circle, rgba(0,0,0,.22) 1.1px, transparent 1.25px)";
    case "linen":
      return "repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, rgba(0,0,0,.06) 0 1px, transparent 1px 5px)";
    case "grid":
      return "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)";
    case "carbon":
      return "repeating-linear-gradient(45deg, rgba(255,255,255,.04) 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, rgba(0,0,0,.28) 0 2px, transparent 2px 4px)";
    case "film":
      return "repeating-linear-gradient(90deg, transparent 0 18px, rgba(0,0,0,.18) 18px 20px), url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.28'/></svg>\")";
    default:
      return "";
  }
}

export function textureSize(id: TextureId): string | undefined {
  if (id === "halftone") return "7px 7px";
  if (id === "grid") return "24px 24px";
  if (id === "film") return "auto, 140px 140px";
  return undefined;
}

export function paperBackground(
  bg: string,
  bg2: string,
  paper: PaperMode,
  angle: number,
  texture: TextureId,
): { backgroundColor: string; backgroundImage: string; backgroundSize?: string } {
  const wash =
    paper === "linear"
      ? `linear-gradient(${angle}deg, ${bg}, ${bg2})`
      : paper === "radial"
        ? `radial-gradient(circle at 28% 22%, ${bg2}, ${bg} 72%)`
        : "";
  const tex = textureLayer(texture);
  const layers = [tex, wash].filter(Boolean).join(", ");
  return {
    backgroundColor: bg,
    backgroundImage: layers,
    backgroundSize: textureSize(texture),
  };
}

export function inkCss(
  fg: string,
  fg2: string,
  ink: InkMode,
  angle: number,
): Record<string, string> {
  if (ink === "solid") return { color: fg, backgroundImage: "none" };
  const image =
    ink === "radial"
      ? `radial-gradient(circle at 30% 20%, ${fg2}, ${fg} 70%)`
      : `linear-gradient(${angle}deg, ${fg}, ${fg2})`;
  return {
    color: "transparent",
    backgroundImage: image,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };
}
