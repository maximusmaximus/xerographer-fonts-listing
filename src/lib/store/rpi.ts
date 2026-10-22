/**
 * RPI Print API client + order-create logic. Server-only.
 * The Authorization header value comes from env RPI_API_AUTH (already "Basic ...") and is never logged.
 */
import type { RpiClient, RpiResult, StoreDeps } from "./types.ts";
import type { State } from "./state.ts";
import { transition, audit } from "./state.ts";
import { customerOrderIdFor } from "./ids.ts";
import { tripKillSwitch } from "./settings.ts";
import { sendAlert, sendShipped, type OrderRow } from "./emails.ts";

export const BOOK = {
  sku: "BKPH_HCIW_STD_11.750x11.750IN_80C_MT_40_100T_GLS_44",
  pageCount: 530,
  retailPrice: "250.00",
  priceCents: 25000,
  editionSize: 500,
  itemDescription: "Xerographer Specimen Ledger (530pp)",
  // Template = RPI production order ord_06GKRYHG31TN7F4G5M8GY95ZHW (customerOrderId specimen-ledger-530pp-gls-003),
  // placed Oct 14, 2026 3:13 PM PT, preflight passed (0 fatal; autofix: rendering intent only), status SHIPPED.
  // Cover:    13,504,418 bytes, md5 0ebb5f8f345b537c44ae3ea4b0872f67
  // Interior: 1,329,989,718 bytes, md5 ef6e138de446f67eb9e489823bb9453f, 530 pages
  coverUrl: "https://gateway.pinata.cloud/ipfs/bafybeia6w4ddas57s24alpcswku74o6au6fisfs4a3qrv57kfwz2bpz2xe",
  gutsUrl: "https://gateway.pinata.cloud/ipfs/bafybeidux326xwjllzedkvqaivxryx3segqtbgyhuv2qdr3d7hdedoew2q",
} as const;

export function httpRpiClient(opts: { baseUrl: string; auth: string | undefined; fetchImpl?: typeof fetch; log?: (m: string) => void }): RpiClient {
  const f = opts.fetchImpl ?? fetch;
  async function call(method: string, path: string, body?: unknown): Promise<RpiResult> {
    if (!opts.auth) return { kind: "network", error: "RPI_API_AUTH not set" };
    try {
      const res = await f(opts.baseUrl.replace(/\/$/, "") + path, {
        method,
        headers: { Authorization: opts.auth, "Content-Type": "application/json", Accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const errorDescription = json?.errorDescription ?? json?.error?.errorDescription;
      opts.log?.(`[rpi] ${method} ${path.split("?")[0]} -> ${res.status}${errorDescription ? ` ${errorDescription}` : ""}`);
      if (res.status >= 200 && res.status < 300) return { kind: "ok", status: res.status, body: json };
      return { kind: "http", status: res.status, body: json, errorDescription };
    } catch (e) {
      opts.log?.(`[rpi] ${method} ${path.split("?")[0]} -> network error`);
      return { kind: "network", error: e instanceof Error ? e.name : "error" };
    }
  }
  return {
    create: (body) => call("POST", "/orders/create", body),
    get: (id) => call("GET", `/orders/${encodeURIComponent(id)}`),
    cancel: (id) => call("DELETE", `/orders/${encodeURIComponent(id)}`),
    list: ({ limit, offset = 0, status }) =>
      call("GET", `/orders?limit=${limit}&offset=${offset}${status ? `&status=${encodeURIComponent(status)}` : ""}`),
  };
}

/** Pull the status out of an OrderFullResponse (shape verified against sandbox before launch). */
export function rpiStatusOf(body: any): string | undefined {
  return body?.status ?? body?.order?.status ?? body?.orderStatus ?? undefined;
}

export function mapRpiStatus(s: string | undefined): State | "CANCELLED" | undefined {
  switch (s) {
    case "QUEUED": case "RECEIVED": case "VALIDATING": return "RPI_CREATED";
    case "VALID_AWAITING_PAYMENT": return "CANCEL_WINDOW";
    case "VALID_HOLDING_BIN": case "PRINTING": case "RECEIVED_BY_PRINTER": case "IN_PRODUCTION": case "READY_TO_SHIP": return "LOCKED";
    case "SHIPPED": return "SHIPPED";
    case "FAILED": return "PREFLIGHT_REJECTED";
    case "REJECTED": return "RPI_REJECTED";
    case "CANCELLED": return "CANCELLED";
    case "EXCEPTION": case "CANCELLATION_REQUESTED": return "NEEDS_ATTENTION";
    default: return undefined;
  }
}

/** Forward-only rank, so a stale webhook/GET never moves an order backwards. */
const RANK: Partial<Record<string, number>> = {
  RPI_CREATING: 1, RPI_CREATED: 2, PREFLIGHT_REJECTED: 3, RPI_REJECTED: 3, CANCEL_WINDOW: 4, LOCKED: 5, SHIPPED: 6,
};

export function buildCreateBody(deps: StoreDeps, order: OrderRow, customerOrderId: string) {
  const a = JSON.parse(order.ship_address_json ?? "{}");
  const destination: Record<string, string> = {
    name: order.ship_name, address1: a.line1, city: a.city, regionCode: a.state, postal: a.postal_code, country: "US",
  };
  if (a.line2) destination.address2 = a.line2;
  if (order.email) destination.email = order.email;
  if (order.phone) destination.phone = order.phone;
  return {
    customerOrderId,
    currency: "USD",
    shippingClassification: order.ship_method ?? "standard",
    webhookUrl: `${deps.config.publicBaseUrl}/api/store/rpi/webhook?o=${order.id}`,
    payload: JSON.stringify({ s: order.stripe_session_id, t: order.id }),
    destination,
    orderItems: [
      {
        sku: BOOK.sku,
        quantity: 1,
        retailPrice: BOOK.retailPrice,
        itemDescription: BOOK.itemDescription,
        product: { coverUrl: BOOK.coverUrl, gutsUrl: BOOK.gutsUrl },
      },
    ],
  };
}

const BACKOFF_MIN = [1, 2, 5, 15, 30, 60];

async function loadOrder(deps: StoreDeps, id: string): Promise<OrderRow> {
  const [o] = await deps.db.query<OrderRow>("select * from store_orders where id = $1", [id]);
  if (!o) throw new Error("order not found");
  return o;
}

/**
 * Create the RPI order. Never invents a new id: on an ambiguous outcome it GETs first.
 * `suffix` is "" for the first order, "-r1" for a preflight re-order, "-rp1" for a replacement.
 */
export async function rpiCreate(deps: StoreDeps, orderId: string, actor = "system", suffix = ""): Promise<string> {
  let order = await loadOrder(deps, orderId);
  const id = customerOrderIdFor(deps.config.env, order.stripe_session_id, suffix);
  const now = await deps.now();
  if (order.state !== "RPI_CREATING") {
    const ok = await transition(deps.db, orderId, "RPI_CREATING", actor, `create ${id}`);
    if (!ok) return "skipped";
  }
  await deps.db.query(
    `update store_orders set customer_order_id = $2, rpi_attempt = rpi_attempt + 1,
       rpi_first_sent_at = coalesce(rpi_first_sent_at, $3), updated_at = now() where id = $1`,
    [orderId, id, now.toISOString()],
  );
  order = await loadOrder(deps, orderId);
  const res = await deps.rpi.create(buildCreateBody(deps, order, id));
  return handleCreateResult(deps, order, id, res);
}

async function adoptOrRetry(deps: StoreDeps, order: OrderRow, id: string): Promise<string> {
  const g = await deps.rpi.get(id);
  if (g.kind === "ok") {
    await transition(deps.db, order.id, "RPI_CREATED", "system", "adopted existing RPI order", { rpi_status: rpiStatusOf(g.body) ?? null, rpi_next_retry_at: null });
    return "adopted";
  }
  if (g.kind === "http" && (g.status === 401 || g.status === 403)) {
    await tripKillSwitch(deps, `RPI auth failed (${g.status})`);
    return "auth_failed";
  }
  const attempts = order.rpi_attempt ?? 1;
  if (attempts >= BACKOFF_MIN.length) {
    await transition(deps.db, order.id, "NEEDS_ATTENTION", "system", "RPI create retries exhausted", { last_error: "retries exhausted" });
    await sendAlert(deps, "RPI create failed", `Order ${order.id.slice(0, 8)} (${id}) could not be created after ${attempts} attempts.`);
    return "needs_attention";
  }
  const next = new Date((await deps.now()).getTime() + BACKOFF_MIN[attempts - 1]! * 60_000);
  await deps.db.query("update store_orders set rpi_next_retry_at = $2, last_error = $3, updated_at = now() where id = $1", [order.id, next.toISOString(), "create outcome unknown; retry scheduled"]);
  return "retry_scheduled";
}

async function handleCreateResult(deps: StoreDeps, order: OrderRow, id: string, res: RpiResult): Promise<string> {
  if (res.kind === "ok") {
    await transition(deps.db, order.id, "RPI_CREATED", "system", `RPI ${res.status}`, { rpi_status: rpiStatusOf(res.body) ?? "QUEUED", rpi_next_retry_at: null, last_error: null });
    return "created";
  }
  if (res.kind === "http" && (res.status === 401 || res.status === 403)) {
    await tripKillSwitch(deps, `RPI auth failed (${res.status})`);
    await deps.db.query("update store_orders set last_error = $2 where id = $1", [order.id, `RPI ${res.status}`]);
    return "auth_failed";
  }
  if (res.kind === "http" && res.status === 400) {
    const desc = String(res.errorDescription ?? "");
    if (/already|duplicate|exists/i.test(desc)) {
      const g = await deps.rpi.get(id);
      if (g.kind === "ok") {
        await transition(deps.db, order.id, "RPI_CREATED", "system", "adopted after duplicate id", { rpi_status: rpiStatusOf(g.body) ?? null });
        return "adopted";
      }
    }
    await transition(deps.db, order.id, "NEEDS_ATTENTION", "system", "RPI 400", { last_error: desc.slice(0, 500) || "RPI 400" });
    await sendAlert(deps, "RPI rejected an order", `Order ${order.id.slice(0, 8)} (${id}): ${desc || "400"}`);
    return "needs_attention";
  }
  // timeout, network error, 5xx: GET before any retry
  return adoptOrRetry(deps, order, id);
}

/** Retry path used by the reconcile cron for RPI_CREATING orders whose retry time has come. */
export async function rpiRetryCreating(deps: StoreDeps, order: OrderRow): Promise<string> {
  const id = order.customer_order_id as string;
  const g = await deps.rpi.get(id);
  if (g.kind === "ok") {
    await transition(deps.db, order.id, "RPI_CREATED", "cron", "adopted on retry", { rpi_status: rpiStatusOf(g.body) ?? null, rpi_next_retry_at: null });
    return "adopted";
  }
  if (g.kind === "http" && g.status === 404) {
    await deps.db.query("update store_orders set rpi_attempt = rpi_attempt + 1 where id = $1", [order.id]);
    const fresh = await loadOrder(deps, order.id);
    const res = await deps.rpi.create(buildCreateBody(deps, fresh, id));
    return handleCreateResult(deps, fresh, id, res);
  }
  return adoptOrRetry(deps, order, id);
}

export const DOWNLOAD_CLASS = ["SOURCE_ERROR", "DOWNLOAD_TIMEOUT", "DOWNLOAD_TOO_SLOW", "INGEST_TIMEOUT", "PROCESSING_TIMEOUT", "DNS_FAILED"];

function trackingFrom(body: any) {
  const t = Array.isArray(body?.shipmentTracking) ? body.shipmentTracking[0] : body?.shipmentTracking;
  if (!t) return null;
  return { trackingNumber: t.trackingNumber ?? null, trackingUrl: t.trackingUrl ?? null, carrier: t.carrier ?? t.carrierName ?? null };
}

/**
 * Apply an authoritative RPI GET result to the site order (forward-only).
 * Returns the new site state, or null if nothing changed.
 */
export async function applyRpiStatus(deps: StoreDeps, orderId: string, body: any, actor: string): Promise<string | null> {
  const order = await loadOrder(deps, orderId);
  const rpiStatus = rpiStatusOf(body);
  const target = mapRpiStatus(rpiStatus);
  await deps.db.query("update store_orders set rpi_status = $2, updated_at = now() where id = $1", [orderId, rpiStatus ?? null]);
  if (!target) return null;
  if (target === "CANCELLED") return null; // the cancel flow owns this transition
  if (["CANCEL_REQUESTED", "CANCELLED_REFUNDED", "DISPUTED", "NEEDS_ATTENTION", "REPRINT_REQUESTED", "REPRINT_APPROVED", "REPRINT_SHIPPED", "REPRINT_DECLINED"].includes(order.state)) {
    // A cancel that RPI overtook: the book went to print anyway.
    if (order.state === "CANCEL_REQUESTED" && (target === "LOCKED" || target === "SHIPPED")) {
      await transition(deps.db, orderId, "NEEDS_ATTENTION", actor, `RPI ${rpiStatus} while cancel requested`);
      await sendAlert(deps, "Cancel overtaken by printing", `Order ${orderId.slice(0, 8)} was cancelled before the deadline but RPI reports ${rpiStatus}. The customer is owed a refund per the terms.`);
    }
    return null;
  }
  if (target === "NEEDS_ATTENTION") {
    await transition(deps.db, orderId, "NEEDS_ATTENTION", actor, `RPI ${rpiStatus}`);
    await sendAlert(deps, "RPI order needs attention", `Order ${orderId.slice(0, 8)}: RPI status ${rpiStatus}.`);
    return target;
  }
  if ((RANK[target] ?? 0) <= (RANK[order.state] ?? 0)) return null;
  const now = (await deps.now()).toISOString();
  const extra: Record<string, unknown> = {};
  if (target === "LOCKED") extra.locked_at = now;
  if (target === "SHIPPED") {
    extra.shipped_at = now;
    extra.tracking_json = JSON.stringify(trackingFrom(body) ?? {});
    if (order.state !== "LOCKED" && !order.locked_at) extra.locked_at = now;
  }
  if (target === "PREFLIGHT_REJECTED") {
    const text = JSON.stringify(body?.validations ?? body?.items ?? "");
    const retryable = DOWNLOAD_CLASS.some((c) => text.includes(c)) && (order.rpi_attempt ?? 0) < 2;
    if (retryable) extra.rpi_next_retry_at = new Date(Date.parse(now) + 30 * 60_000).toISOString();
    const ok = await transition(deps.db, orderId, "PREFLIGHT_REJECTED", actor, retryable ? "preflight failed (download); -r1 scheduled" : "preflight failed", extra);
    if (ok && !retryable) {
      await transition(deps.db, orderId, "NEEDS_ATTENTION", actor, "preflight failed, not retryable");
      await sendAlert(deps, "RPI preflight failed", `Order ${orderId.slice(0, 8)} failed preflight. Check RPI validations.`);
      return "NEEDS_ATTENTION";
    }
    return ok ? target : null;
  }
  const ok = await transition(deps.db, orderId, target, actor, `RPI ${rpiStatus}`, extra);
  if (ok && target === "SHIPPED") {
    await sendShipped(deps, await loadOrder(deps, orderId));
  }
  if (ok && target === "RPI_REJECTED") await sendAlert(deps, "RPI rejected order (limit queue)", `Order ${orderId.slice(0, 8)}: ${rpiStatus}`);
  return ok ? target : null;
}

export { audit };
