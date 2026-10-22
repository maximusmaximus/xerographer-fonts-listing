// Cloudflare Worker (Max's account) that drives the store's timed jobs.
// Secret: CRON_SECRET (same value as the site's CRON_SECRET). Var: SITE = "https://fonts.grok.me".
// Triggers (UTC): "*/15 * * * *" reconcile, "0 1 * * *" daily-review, "15 2 * * *" post-charge.
// Signature = "v1=" + hex HMAC-SHA256(CRON_SECRET, `${ts}.POST.${path}`). No secret values in this file.
const JOBS = { "*/15 * * * *": "reconcile", "0 1 * * *": "daily-review", "15 2 * * *": "post-charge" };

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async scheduled(event, env, ctx) {
    const job = JOBS[event.cron];
    if (!job) return;
    const path = `/api/store/cron/${job}`;
    const ts = Math.floor(Date.now() / 1000);
    const sig = "v1=" + (await hmacHex(env.CRON_SECRET, `${ts}.POST.${path}`));
    ctx.waitUntil(fetch(`${env.SITE}${path}`, { method: "POST", headers: { "x-cron-timestamp": String(ts), "x-cron-signature": sig } }));
  },
};
