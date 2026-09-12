export type Align = "left" | "center" | "right" | "justify";
export type CaseMode = "none" | "upper" | "lower" | "title";

export type WrappedLine = {
  text: string;
  lastInParagraph: boolean;
};

export const SAMPLE_COPY =
  "The quick brown fox jumps over the lazy dog.\nPack my box with five dozen liquor jugs.";

export const LOOKS = [
  { name: "Foundry", bg: "#121212", fg: "#f2efe6" },
  { name: "Paper", bg: "#f3efe4", fg: "#161513" },
  { name: "Night", bg: "#0a0a0a", fg: "#ffffff" },
  { name: "Day", bg: "#ffffff", fg: "#111111" },
] as const;

export function applyCase(text: string, mode: CaseMode): string {
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();
  if (mode === "title") {
    return text.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  return text;
}

export function wrapLines(text: string, maxWidth: number, measure: (value: string) => number): WrappedLine[] {
  const width = Math.max(maxWidth, 1);
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: WrappedLine[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push({ text: "", lastInParagraph: true });
      continue;
    }
    const words = para.trim().split(/\s+/);
    const packed: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && measure(next) > width) {
        packed.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) packed.push(current);
    packed.forEach((line, i) => {
      lines.push({ text: line, lastInParagraph: i === packed.length - 1 });
    });
  }
  return lines;
}

export function shouldJustify(align: Align, line: WrappedLine): boolean {
  return align === "justify" && !line.lastInParagraph && /\s/.test(line.text.trim());
}

export function lineOriginX(align: Align, lineWidth: number, boxWidth: number): number {
  if (align === "center") return (boxWidth - lineWidth) / 2;
  if (align === "right") return boxWidth - lineWidth;
  return 0;
}

export function wordGap(words: string[], boxWidth: number, measure: (value: string) => number): number {
  if (words.length < 2) return 0;
  const total = words.reduce((n, word) => n + measure(word), 0);
  return (boxWidth - total) / (words.length - 1);
}

export function specimenSvg(width: number, height: number, bg: string, fill: string, pathData: string[]): string {
  const paths = pathData
    .filter(Boolean)
    .map((d) => `<path d="${d}" fill="${fill}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${width} ${height}">\n<rect width="100%" height="100%" fill="${bg}"/>\n${paths}\n</svg>\n`;
}

export function fileStem(slug: string): string {
  return `${slug.replace(/[^a-z0-9-]+/gi, "-")}-specimen`;
}
