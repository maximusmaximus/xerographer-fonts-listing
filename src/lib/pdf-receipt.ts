import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { LICENSE_TERMS } from "./constants.ts";
import type { LicenseGrant, X402Receipt } from "./x402";

export type ReceiptPdfInput = {
  id: string;
  issuedAt: string;
  grant: LicenseGrant;
  receipt: X402Receipt;
};

export async function buildLicensePdf(input: ReceiptPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const ink = rgb(0.09, 0.09, 0.08);
  const muted = rgb(0.38, 0.36, 0.33);
  const rule = rgb(0.78, 0.75, 0.7);

  const page = doc.addPage([612, 792]);
  const draw = (text: string, x: number, y: number, size: number, font = serif) => {
    page.drawText(text, { x, y, size, font, color: ink });
  };

  const catalog = input.grant.scope === "catalog" || input.grant.fontSlug === "catalog";
  draw("XEROGRAPHER FONTS", 56, 730, 11, serifBold);
  draw(catalog ? "Catalog Unlimited Commercial Use" : "Unlimited Commercial Use License", 56, 708, 18, serifBold);
  page.drawLine({ start: { x: 56, y: 694 }, end: { x: 556, y: 694 }, thickness: 0.6, color: rule });

  const grant = input.grant.permission;
  wrapText(grant, 78).forEach((line, i) => draw(line, 56, 662 - i * 14, 11));

  const rows: [string, string][] = [
    ["Receipt", input.id],
    ["Issued", input.issuedAt],
    ["Typeface", input.grant.fontName],
    ["Slug", input.grant.fontSlug],
    ["Scope", catalog ? "Entire catalog, one agent" : "Single typeface, one agent"],
    ["Licensee", input.grant.licensee],
    ["Email", input.grant.email ?? "—"],
    ["Price", `US$${input.grant.priceUsd.toLocaleString("en-US")} USDC`],
    ["Network", input.receipt.network],
    ["Transaction", input.receipt.transaction],
    ["DaFont", input.grant.sources.dafont],
    ["Download", input.grant.sources.download],
    ["Designer", input.grant.sources.designer],
  ];

  let y = 500;
  for (const [label, value] of rows) {
    draw(label.toUpperCase(), 56, y, 8, serifBold);
    const lines = wrapText(value, 62, 7.2);
    lines.forEach((line, i) => {
      page.drawText(line, { x: 168, y: y - i * 12, size: 10, font: mono, color: ink });
    });
    y -= 16 + Math.max(0, lines.length - 1) * 12;
  }

  page.drawLine({ start: { x: 56, y: 88 }, end: { x: 556, y: 88 }, thickness: 0.6, color: rule });
  page.drawText("Licensor: Max Infeld / Xerographer Fonts  ·  maxinfeld@gmail.com", {
    x: 56,
    y: 68,
    size: 9,
    font: serif,
    color: muted,
  });
  page.drawText("x402 PAYMENT-RESPONSE is the machine-readable counterpart of this grant.", {
    x: 56,
    y: 54,
    size: 9,
    font: serif,
    color: muted,
  });

  const termsPage = doc.addPage([612, 792]);
  termsPage.drawText("Terms", { x: 56, y: 730, size: 18, font: serifBold, color: ink });
  termsPage.drawLine({ start: { x: 56, y: 716 }, end: { x: 556, y: 716 }, thickness: 0.6, color: rule });
  const terms = input.grant.terms || LICENSE_TERMS;
  wrapText(terms, 78).forEach((line, i) => {
    termsPage.drawText(line, { x: 56, y: 688 - i * 14, size: 11, font: serif, color: ink });
  });
  termsPage.drawText("Resale of the font files and unapproved editing of the typefaces are not licensed.", {
    x: 56,
    y: 54,
    size: 9,
    font: serif,
    color: muted,
  });

  return doc.save();
}

function wrapText(text: string, maxChars: number, _widthEm = 6.5): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
