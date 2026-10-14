import raw from "../data/coverage.json" with { type: "json" };

/**
 * Glyph coverage for faces that were expanded in the xerographer-fonts repo
 * (generated from each face's font.json "coverage" block).
 */
export type Coverage = {
  latin1: number | null;
  latinExtendedA: number | null;
  glyphs: number | null;
  updated: string | null;
  /** Path of the expanded font file in the public repo. */
  repoFile: string;
};

const table = raw as Record<string, Coverage>;

export const ACCENT_SAMPLES = {
  latin1: ["Café résumé naïve", "Straße Größe"],
  centralEuropean: ["Cześć Łódź", "Žluťoučký kůň"],
} as const;

export function coverageFor(slug: string): Coverage | null {
  return table[slug] ?? null;
}

export function hasLatin1(c: Coverage | null): boolean {
  return c?.latin1 != null && c.latin1 >= 90;
}

export function hasCentralEuropean(c: Coverage | null): boolean {
  return c?.latinExtendedA != null && c.latinExtendedA >= 95;
}

export function supportsAccents(slug: string): boolean {
  const c = coverageFor(slug);
  return hasLatin1(c) || hasCentralEuropean(c);
}

/** Language badges shown on cards and the font page. */
export function languageBadges(slug: string): string[] {
  const c = coverageFor(slug);
  const out: string[] = [];
  if (hasLatin1(c)) out.push("Latin-1");
  if (hasCentralEuropean(c)) out.push("Central European");
  return out;
}

/** Accented sample lines, only for the sets the face actually covers. */
export function accentSamples(slug: string): string[] {
  const c = coverageFor(slug);
  return [
    ...(hasLatin1(c) ? ACCENT_SAMPLES.latin1 : []),
    ...(hasCentralEuropean(c) ? ACCENT_SAMPLES.centralEuropean : []),
  ];
}

export function accentSampleLine(slug: string): string | null {
  const lines = accentSamples(slug);
  return lines.length ? lines.join(" · ") : null;
}

export const ACCENT_FACE_COUNT = Object.keys(table).filter((s) => supportsAccents(s)).length;
