import { createHash, randomBytes } from "node:crypto";

/** 128-bit random URL-safe token (order ids, request ids, photo ids). */
export function randomToken(): string {
  return randomBytes(16).toString("base64url");
}

const B32 = "abcdefghijklmnopqrstuvwxyz234567";

/** RFC 4648 base32, lowercase, no padding. */
export function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Deterministic RPI customerOrderId for a Stripe Checkout Session:
 * "xsl-<env>-" + first 26 chars of base32(sha256(sessionId)) + suffix. Max 40 chars.
 * The same session always maps to the same id, so a retried create can never
 * produce a second print order.
 */
export function customerOrderIdFor(env: "sbx" | "prod", stripeSessionId: string, suffix = ""): string {
  const digest = createHash("sha256").update(stripeSessionId).digest();
  const id = `xsl-${env}-${base32(digest).slice(0, 26)}${suffix}`;
  if (id.length > 40) throw new Error("customerOrderId longer than 40 chars");
  return id;
}

export const shortId = (token: string) => token.slice(0, 8);
