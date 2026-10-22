export type BookProduct = {
  title: string;
  specs: string;
  description: string;
  priceLabel: string;
  priceNote: string;
  listed: boolean;
};

export const BOOK_PRODUCT_DEFAULTS: BookProduct = {
  title: "Xerographer Specimen Ledger",
  specs: "530-page hardcover · 11.75 × 11.75 in · full color on 100# gloss · ImageWrap cover",
  description:
    "Every Xerographer face, set and printed: the full catalog of 1,376 original typefaces drawn since 2012 — eroded, cartoon, script, horror, stencil and the rest of the photocopy cabinet — gathered into one oversized specimen ledger.",
  priceLabel: "$250",
  priceNote: "plus shipping at cost and sales tax",
  listed: true,
};

const LIMITS = {
  title: 120,
  specs: 300,
  description: 2000,
  priceLabel: 40,
  priceNote: 160,
} as const;

export function sanitizeProduct(input: unknown): { ok: true; product: BookProduct } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "missing product" };
  const raw = input as Record<string, unknown>;
  const text = (key: keyof typeof LIMITS) => (typeof raw[key] === "string" ? raw[key].trim() : "");
  const product: BookProduct = {
    title: text("title"),
    specs: text("specs"),
    description: text("description"),
    priceLabel: text("priceLabel"),
    priceNote: text("priceNote"),
    listed: raw.listed !== false,
  };
  for (const key of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
    if (!product[key]) return { ok: false, error: `${key} is required` };
    if (product[key].length > LIMITS[key]) return { ok: false, error: `${key} is too long` };
  }
  return { ok: true, product };
}
