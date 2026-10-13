import type { StoreDeps } from "./types.ts";
import { cronSignature, safeEqualStr } from "./hmac.ts";
import { FINAL_STATES } from "./state.ts";
import { applyRpiStatus, rpiCreate, rpiRetryCreating, rpiStatusOf } from "./rpi.ts";
import { exposureUsd as exposureEstimate } from "./settings.ts";
import { processCancel } from "./cancel.ts";
import { capCheck, storeGuard } from "./settings.ts";
import { transition, audit } from "./state.ts";
import { sendAlert, sendDailyDigest, type OrderRow } from "./emails.ts";
import { purgePhotos, totalPhotoBytes, PHOTO_ALERT_BYTES } from "./photos.ts";

export const CRON_JOBS = ["reconcile", "daily-review", "post-charge"] as const;
export type CronJob = (typeof CRON_JOBS)[number];

export async function authorizeCron(
  deps: Pick<StoreDeps, "db">,
  headers: Headers,
  path: string,
  secret: string | undefined,
  nowMs: number,
): Promise<{ ok: true } | { ok: false; status: number }> {
  const ts = headers.get("x-cron-timestamp");
  const sig = headers.get("x-cron-signature");
  if (!secret || !ts || !sig || !/^\d{9,11}$/.test(ts)) return { ok: false, status: 401 };
  if (Math.abs(nowMs / 1000 - Number(ts)) > 300) return { ok: false, status: 401 };
  if (!safeEqualStr(sig, cronSignature(secret, ts, path))) return { ok: false, status: 401 };
  const ins = await deps.db.query(
    "insert into store_cron_runs (path, ts) values ($1, $2) on conflict do nothing returning ts",
    [path, Number(ts)],
  );
  if (!ins.length) return { ok: false, status: 409 };
  return { ok: true };
}

const LIMIT = 50;
const STUCK_MS = 2 * 60 * 60 * 1000;
const WAITING = new Set(["CANCEL_WINDOW", "LOCKED", "SHIPPED", "DEFERRED", "HELD", "REPRINT_REQUESTED", "REPRINT_APPROVED", "DISPUTED", "NEEDS_ATTENTION"]);

export async function reconcile(deps: StoreDeps) {
  const now = await deps.now();
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  const rows = await deps.db.query<OrderRow>(
    `select * from store_orders where state not in ('CHECKOUT_OPEN','EXPIRED','CANCELLED_REFUNDED','REPRINT_SHIPPED','REPRINT_DECLINED','DISPUTED')
     order by updated_at asc limit ${LIMIT}`,
  );
  for (const o of rows) {
    try {
      if (o.state === "CANCEL_REQUESTED") bump(`cancel_${await processCancel(deps, o.id, "cron")}`);
      else if (o.state === "RPI_CREATING" && o.customer_order_id && (!o.rpi_next_retry_at || new Date(o.rpi_next_retry_at) <= now))
        bump(`create_${await rpiRetryCreating(deps, o)}`);
      else if (o.state === "PREFLIGHT_REJECTED" && o.rpi_next_retry_at && new Date(o.rpi_next_retry_at) <= now)
        bump(`reorder_${await rpiCreate(deps, o.id, "cron", "-r1")}`);
      else if (o.state === "DEFERRED" && o.deferred_until_utc && new Date(o.deferred_until_utc) <= now) bump(`deferred_${await releaseDeferred(deps, o)}`);
      else if (o.customer_order_id && !FINAL_STATES.has(o.state as never) && ["RPI_CREATED", "CANCEL_WINDOW", "LOCKED"].includes(o.state)) {
        const g = await deps.rpi.get(o.customer_order_id);
        if (g.kind === "ok") bump(`applied_${(await applyRpiStatus(deps, o.id, g.body, "cron")) ?? "none"}`);
        else bump("get_failed");
      }
      // Stuck alert (once per order).
      const [cur] = await deps.db.query<OrderRow>("select * from store_orders where id = $1", [o.id]);
      if (cur && !WAITING.has(cur.state) && !FINAL_STATES.has(cur.state as never) && !cur.alerted_stuck_at &&
          now.getTime() - new Date(cur.updated_at).getTime() > STUCK_MS) {
        await deps.db.query("update store_orders set alerted_stuck_at = now() where id = $1", [o.id]);
        await sendAlert(deps, "Order stuck", `Order ${o.id.slice(0, 8)} has been in ${cur.state} for over 2 hours.`);
        bump("stuck_alerts");
      }
    } catch {
      bump("errors");
    }
  }
  return { scanned: rows.length, ...counts };
}

async function releaseDeferred(deps: StoreDeps, o: OrderRow): Promise<string> {
  const guard = await storeGuard(deps.db);
  const cap = await capCheck(deps.db, await deps.now(), o.amount_shipping_cents ?? 0);
  if (!guard.open || !cap.ok) {
    await transition(deps.db, o.id, "HELD", "cron", !guard.open ? "kill switch" : "daily cap");
    await sendAlert(deps, "Deferred order held", `Order ${o.id.slice(0, 8)} was held at release (${!guard.open ? "kill switch" : "daily cap"}).`);
    return "held";
  }
  return rpiCreate(deps, o.id, "cron");
}

export async function postCharge(deps: StoreDeps) {
  const rows = await deps.db.query<OrderRow>(`select * from store_orders where state = 'DEFERRED' order by paid_at asc limit ${LIMIT}`);
  const out: Record<string, number> = {};
  for (const o of rows) {
    const r = await releaseDeferred(deps, o).catch(() => "error");
    out[r] = (out[r] ?? 0) + 1;
  }
  return { deferred: rows.length, ...out };
}

export async function dailyReview(deps: StoreDeps) {
  const summary: Record<string, unknown> = {};
  const cancels = await deps.db.query<OrderRow>(`select id from store_orders where state = 'CANCEL_REQUESTED' limit ${LIMIT}`);
  for (const c of cancels) await processCancel(deps, c.id, "cron").catch(() => undefined);
  summary.cancelsProcessed = cancels.length;

  // Orders waiting for tonight's charge: anything refunded / disputed / flagged in Stripe gets cancelled at RPI.
  const window = await deps.db.query<OrderRow>(`select * from store_orders where state = 'CANCEL_WINDOW' limit ${LIMIT}`);
  let flagged = 0;
  for (const o of window) {
    if (!o.stripe_payment_intent_id || !deps.stripe.paymentIntents) continue;
    const pi = await deps.stripe.paymentIntents.retrieve(o.stripe_payment_intent_id, { expand: ["latest_charge"] }).catch(() => null);
    const ch = pi?.latest_charge;
    if (ch && (ch.refunded || ch.amount_refunded > 0 || ch.disputed)) {
      flagged += 1;
      await deps.rpi.cancel(o.customer_order_id);
      await transition(deps.db, o.id, "NEEDS_ATTENTION", "cron", "refunded/disputed in Stripe before charge");
    }
  }
  summary.flaggedBeforeCharge = flagged;

  // RPI orders awaiting payment that we don't know about.
  const known = new Set((await deps.db.query<{ customer_order_id: string }>("select customer_order_id from store_orders where customer_order_id is not null")).map((r) => r.customer_order_id));
  const prefix = `xsl-${deps.config.env}-`;
  let orphanCancelled = 0;
  const manual: string[] = [];
  let estimate = 0;
  for (let offset = 0; offset < 1000; offset += 100) {
    const l = await deps.rpi.list({ limit: 100, offset, status: "VALID_AWAITING_PAYMENT" });
    if (l.kind !== "ok") break;
    const items: any[] = l.body?.orders ?? l.body?.data ?? l.body?.items ?? (Array.isArray(l.body) ? l.body : []);
    for (const it of items) {
      if (rpiStatusOf(it) && rpiStatusOf(it) !== "VALID_AWAITING_PAYMENT") continue;
      const id = String(it.customerOrderId ?? "");
      estimate += Number(it.pricing?.total ?? it.pricing?.totalPrice ?? 0) || 0;
      if (id.startsWith("xsl-") && !known.has(id)) {
        if (id.startsWith(prefix)) {
          await deps.rpi.cancel(id);
          orphanCancelled += 1;
        }
      } else if (!id.startsWith("xsl-")) manual.push(id);
    }
    if (items.length < 100) break;
  }
  summary.orphansCancelled = orphanCancelled;
  if (orphanCancelled) await sendAlert(deps, "Cancelled unknown RPI orders", `${orphanCancelled} RPI order(s) with our id prefix were not in the store database and were cancelled.`);

  const counts = Object.fromEntries(
    (await deps.db.query<{ state: string; n: number }>("select state, count(*)::int as n from store_orders group by state")).map((r) => [r.state, r.n]),
  );
  const awaiting = (counts.CANCEL_WINDOW as number) ?? 0;
  summary.purged = await purgePhotos(deps);
  const bytes = await totalPhotoBytes(deps.db);
  summary.photoBytes = bytes;
  if (bytes > PHOTO_ALERT_BYTES) await sendAlert(deps, "Claim photo storage above 300 MB", `Stored claim photos: ${(bytes / 1e6).toFixed(1)} MB.`);
  await sendDailyDigest(
    deps,
    `${awaiting} store order(s)${estimate ? `, about $${estimate.toFixed(2)} (RPI estimate, all awaiting orders)` : ` (~$${(awaiting * exposureEstimate(699)).toFixed(2)} estimated)`} will be charged at 02:00 UTC (7 PM PDT / 6 PM PST).
HELD: ${counts.HELD ?? 0} · NEEDS_ATTENTION: ${counts.NEEDS_ATTENTION ?? 0} · REPRINT_REQUESTED: ${counts.REPRINT_REQUESTED ?? 0}
Orders not placed by the store (left alone): ${manual.length ? manual.join(", ") : "none"}`,
  );
  await audit(deps.db, null, "cron", "daily review");
  return summary;
}

export function runCron(deps: StoreDeps, job: CronJob) {
  if (job === "reconcile") return reconcile(deps);
  if (job === "post-charge") return postCharge(deps);
  return dailyReview(deps);
}
