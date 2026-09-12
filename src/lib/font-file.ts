import JSZip from "jszip";
import { getFont } from "./fonts";

const cache = new Map<string, { bytes: Uint8Array; contentType: string; filename: string }>();

const UA = "Mozilla/5.0 (compatible; XerographerCatalog/1.0; +https://maxi.grok.me)";

export async function loadFontFile(slug: string): Promise<{ bytes: Uint8Array; contentType: string; filename: string } | null> {
  if (!getFont(slug)) return null;
  const hit = cache.get(slug);
  if (hit) return hit;

  const url = `https://dl.dafont.com/dl/?f=${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Referer: `https://www.dafont.com/${slug}.font`,
      Accept: "*/*",
    },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 20) return null;
  const head = new TextDecoder().decode(buf.slice(0, 16));
  if (head.startsWith("<!") || head.startsWith("<html") || head.startsWith("<HTML")) return null;

  const extracted = await extractFontBytes(buf, slug);
  if (!extracted) return null;
  if (cache.size > 80) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(slug, extracted);
  return extracted;
}

async function extractFontBytes(
  buf: Uint8Array,
  slug: string,
): Promise<{ bytes: Uint8Array; contentType: string; filename: string } | null> {
  if (isZip(buf)) {
    const zip = await JSZip.loadAsync(buf);
    const files = Object.keys(zip.files).filter((name) => /\.(ttf|otf|woff2?)$/i.test(name) && !zip.files[name]?.dir);
    files.sort((a, b) => scoreName(a) - scoreName(b));
    const chosen = files[0];
    if (!chosen) return null;
    const bytes = await zip.files[chosen]!.async("uint8array");
    return { bytes, contentType: contentTypeFor(chosen), filename: chosen.split("/").pop() ?? `${slug}.ttf` };
  }
  if (isTtf(buf) || isOtf(buf)) {
    const filename = `${slug}${isOtf(buf) ? ".otf" : ".ttf"}`;
    return { bytes: buf, contentType: contentTypeFor(filename), filename };
  }
  return null;
}

function isZip(buf: Uint8Array): boolean {
  return buf[0] === 0x50 && buf[1] === 0x4b;
}
function isTtf(buf: Uint8Array): boolean {
  return buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00;
}
function isOtf(buf: Uint8Array): boolean {
  return buf[0] === 0x4f && buf[1] === 0x54 && buf[2] === 0x54 && buf[3] === 0x4f;
}
function contentTypeFor(name: string): string {
  if (name.toLowerCase().endsWith(".otf")) return "font/otf";
  if (name.toLowerCase().endsWith(".woff2")) return "font/woff2";
  if (name.toLowerCase().endsWith(".woff")) return "font/woff";
  return "font/ttf";
}
function scoreName(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("regular") || n.includes("normal")) return 0;
  if (n.includes("italic")) return 2;
  if (n.includes("bold")) return 3;
  return 1;
}
