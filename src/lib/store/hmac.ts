import { createHmac, timingSafeEqual } from "node:crypto";

export function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function safeEqualStr(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return safeEqual(Buffer.from(a), Buffer.from(b));
}

/** RPI: base64(HMAC-SHA256(raw body)) in x-rpi-printapi-hmac-sha256. */
export function verifyRpiSignature(raw: string, header: string | null, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  let got: Buffer;
  try {
    got = Buffer.from(header.trim(), "base64");
  } catch {
    return false;
  }
  return safeEqual(expected, got);
}

/** Cron: "v1=" + hex(HMAC-SHA256(secret, `${ts}.POST.${path}`)). */
export function cronSignature(secret: string, ts: string | number, path: string): string {
  return "v1=" + createHmac("sha256", secret).update(`${ts}.POST.${path}`).digest("hex");
}
