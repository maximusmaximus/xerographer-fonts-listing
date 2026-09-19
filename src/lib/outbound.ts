import https from "node:https";
import { URL } from "node:url";

const UA = "Mozilla/5.0 (compatible; XerographerCatalog/1.0; +https://maxi.grok.me)";

export type OutboundResult = {
  status: number;
  bytes: Buffer;
  contentType: string;
};

/**
 * DaFont's cert chain (GandiCert) is often incomplete. Fetch those hosts
 * without requiring a full local CA, and follow redirects for the zip download.
 */
export function dafontGet(
  url: string,
  extraHeaders: Record<string, string> = {},
  hops = 0,
): Promise<OutboundResult> {
  return new Promise((resolve, reject) => {
    if (hops > 6) {
      reject(new Error("Too many redirects"));
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        headers: {
          "User-Agent": extraHeaders["User-Agent"] ?? UA,
          Accept: extraHeaders.Accept ?? "*/*",
          ...extraHeaders,
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          const next = new URL(location, url).href;
          void dafontGet(next, extraHeaders, hops + 1).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            status,
            bytes: Buffer.concat(chunks),
            contentType: String(res.headers["content-type"] ?? "application/octet-stream"),
          });
        });
        res.on("error", reject);
      },
    );
    req.setTimeout(20000, () => req.destroy(new Error("DaFont request timed out")));
    req.on("error", reject);
    req.end();
  });
}
