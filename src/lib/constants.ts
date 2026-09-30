export const LICENSE_USD = 95;
export const CATALOG_LICENSE_USD = 65_000;
export const CATALOG_SLUG = "catalog";
export const CATALOG_FONT_NAME = "Xerographer Fonts — entire catalog";
export const DAFONT_AUTHOR = "https://www.dafont.com/max-infeld.d3584";
export const DESIGNER_URL = "https://maxi.grok.me";
export const CATALOG_SITE = "https://fonts.grok.me";
export const GITHUB_FONTS_REPO = "https://github.com/maximusmaximus/xerographer-fonts";

export const LICENSE_PERMISSION_FONT =
  "The licensee is granted unlimited commercial use of this typeface in the licensee's own work, subject to the terms: the font files may not be resold or redistributed, and the typeface may not be edited or used to create a derivative font without written permission.";

export const LICENSE_PERMISSION_CATALOG =
  "The licensee is granted unlimited commercial use of every typeface in the Xerographer Fonts catalog in the licensee's own work, subject to the terms: the font files may not be resold or redistributed, and the typefaces may not be edited or used to create derivative fonts without written permission.";

export const LICENSE_TERMS = [
  "This license grants the named licensee unlimited commercial use of the listed typeface(s) in the licensee's own work, including embedding in documents, websites, applications, video, merchandise, and other commercial output, without further royalty.",
  "The licensee may not resell, redistribute, sublicense, share, or otherwise transfer the font files themselves — as fonts, as a pack, on a marketplace, or as a competing listing.",
  "The licensee may not modify, convert, reverse-engineer, or create derivative typefaces without prior written permission from Max Infeld / Xerographer Fonts.",
  "The grant is personal to one licensee (one human or one agent / wallet) and is not transferable. Personal donationware use remains available from DaFont.",
].join(" ");

export function usdLabel(n: number): string {
  return `US$${n.toLocaleString("en-US")}`;
}

export function usdAtomic(n: number): string {
  return String(n * 1_000_000);
}
