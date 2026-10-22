/**
 * Store emails. Separate from emailLicenseReceipt (src/lib/email.ts), which is untouched.
 * Every store email carries reply-to STORE_REPLY_TO; customers are never BCC'd to Max.
 */
import type { Mailer, StoreDeps } from "./types.ts";
import { formatPt } from "./time.ts";
import { shortId } from "./ids.ts";

export type OrderRow = Record<string, any> & { id: string; state: string };

const money = (cents: number | null | undefined) => `$${((cents ?? 0) / 100).toFixed(2)}`;

const SHIP_TEXT: Record<string, { label: string; prod: string; transit: string }> = {
  standard: { label: "Standard", prod: "4", transit: "2–5 days" },
  expedited: { label: "Expedited", prod: "4", transit: "2 days" },
  rush: { label: "Rush", prod: "3", transit: "1 day" },
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function render(text: string) {
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${text
    .split("\n\n")
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`)
    .join("")}</div>`;
  return { text, html };
}

function footer(deps: StoreDeps) {
  return `Terms of Sale: ${deps.config.publicBaseUrl}/terms\nQuestions? Just reply to this email.\n— Xerographer Fonts`;
}

export function orderUrl(deps: StoreDeps, order: OrderRow) {
  return `${deps.config.publicBaseUrl}/order/${order.id}`;
}

function addressBlock(order: OrderRow) {
  try {
    const a = JSON.parse(order.ship_address_json ?? "{}");
    return [order.ship_name, a.line1, a.line2, `${a.city ?? ""}, ${a.state ?? ""} ${a.postal_code ?? ""}`]
      .filter(Boolean)
      .join("\n");
  } catch {
    return order.ship_name ?? "";
  }
}

async function send(deps: StoreDeps, to: string | null | undefined, subject: string, text: string) {
  if (!to) return { sent: false, error: "no recipient" };
  const r = await deps.mailer.send({ to, subject, ...render(text) });
  if (!r.sent) deps.log?.(`[store] email "${subject}" not sent: ${r.error ?? "unknown"}`);
  return r;
}

export function confirmationEmail(deps: StoreDeps, order: OrderRow) {
  const s = SHIP_TEXT[order.ship_method ?? "standard"] ?? SHIP_TEXT.standard;
  const first = String(order.ship_name ?? "").split(" ")[0] || "there";
  const subject = `Your Xerographer Specimen Ledger is ordered (#${shortId(order.id)})`;
  const text = `Thanks, ${first}. We've received ${money(order.amount_total_cents)} for 1 × Xerographer Specimen Ledger${order.edition_number ? `, copy ${order.edition_number} of 500` : ""} (limited edition of 500).

Changed your mind? Cancel for a full refund before ${formatPt(new Date(order.cancel_deadline_utc))}: ${orderUrl(deps, order)}
After that your copy goes to print and can't be cancelled or refunded.

Printing ~${s.prod} business days, then ${s.label} (${s.transit}). Tracking follows when it ships.

Ship to:
${addressBlock(order)}

Status: ${orderUrl(deps, order)}

${footer(deps)}`;
  return { subject, text };
}

export const sendOrderConfirmation = (deps: StoreDeps, order: OrderRow) => {
  const m = confirmationEmail(deps, order);
  return send(deps, order.email, m.subject, m.text);
};

export const sendCancelledRefunded = (deps: StoreDeps, order: OrderRow, refundCents: number) =>
  send(
    deps,
    order.email,
    "Your Specimen Ledger order is cancelled",
    `Your order #${shortId(order.id)} is cancelled and ${money(refundCents)} has been refunded to your original payment method (usually 5–10 business days to appear).\n\n${footer(deps)}`,
  );

export function sendShipped(deps: StoreDeps, order: OrderRow, replacement = false) {
  let t: Record<string, string> = {};
  try {
    t = JSON.parse(order.tracking_json ?? "{}");
  } catch {
    /* tracking unknown */
  }
  return send(
    deps,
    order.email,
    replacement ? "Your replacement copy has shipped" : "Your Specimen Ledger has shipped",
    `Tracking: ${t.trackingNumber ?? "(pending)"} (${t.carrier ?? "carrier"}): ${t.trackingUrl ?? orderUrl(deps, order)}

Misprint or damage? Report it within 14 days of delivery at ${orderUrl(deps, order)} and we'll send a free replacement.

${footer(deps)}`,
  );
}

export function sendProblem(deps: StoreDeps, order: OrderRow, plainReason: string, refundCents: number | null) {
  const tail = refundCents != null ? `We've refunded ${money(refundCents)}.` : "We're fixing it and will update you within two business days.";
  return send(
    deps,
    order.email,
    `An update on your Specimen Ledger order (#${shortId(order.id)})`,
    `We hit a snag: ${plainReason}. ${tail} Sorry for the trouble.\n\n${footer(deps)}`,
  );
}

export const sendReprintDeclined = (deps: StoreDeps, order: OrderRow) =>
  send(
    deps,
    order.email,
    `About your Specimen Ledger report (#${shortId(order.id)})`,
    `Thanks for sending the details and photos. After reviewing them, this doesn't look like a printing defect or shipping damage, so we can't send a replacement under our Terms of Sale. If you think we got it wrong, just reply and we'll take another look.\n\n${footer(deps)}`,
  );

export function sendAlert(deps: StoreDeps, subject: string, text: string) {
  return send(deps, deps.config.alertTo, `[Store ${deps.config.env}] ${subject}`, `${text}\n\nAdmin: ${deps.config.publicBaseUrl}/admin/store`);
}

export const sendDailyDigest = (deps: StoreDeps, text: string) => sendAlert(deps, "Daily review", text);

/** Resend-backed mailer. Key is passed in by the caller (read via env.server.ts); never logged. */
export function resendMailer(opts: { apiKey: string | undefined; from: string; replyTo: string; fetchImpl?: typeof fetch }): Mailer {
  return {
    async send(msg) {
      if (!opts.apiKey) return { sent: false, error: "RESEND_API_KEY not set" };
      const res = await (opts.fetchImpl ?? fetch)("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: opts.from, to: [msg.to], reply_to: opts.replyTo, subject: msg.subject, html: msg.html, text: msg.text }),
        signal: AbortSignal.timeout(8000),
      }).catch((e: unknown) => ({ ok: false, status: 0, text: async () => String(e) }) as const);
      if (!res.ok) return { sent: false, error: `resend ${res.status}` };
      return { sent: true };
    },
  };
}
