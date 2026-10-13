import type { StoreDeps } from "./types.ts";
import { safeEqualStr } from "./hmac.ts";
import { transition, audit, STATES, type State } from "./state.ts";
import { getSetting, setSetting, capCheck } from "./settings.ts";
import { rpiCreate, buildCreateBody } from "./rpi.ts";
import { customerOrderIdFor } from "./ids.ts";
import { requestCancel } from "./cancel.ts";
import { totalPhotoBytes } from "./photos.ts";
import { copiesLeft } from "./slots.ts";
import {
  confirmationEmail, sendAlert, sendReprintDeclined, sendShipped, type OrderRow,
} from "./emails.ts";

export function checkAdmin(headers: Headers, adminToken: string | undefined): boolean {
  return safeEqualStr(headers.get("x-admin-token"), adminToken);
}

export async function adminSummary(deps: StoreDeps) {
  const db = deps.db;
  const orders = await db.query(
    `select id, state, created_at, paid_at, ship_method, rpi_status, customer_order_id, cancel_deadline_utc, last_error, risk_level,
            amount_total_cents
     from store_orders where state <> 'CHECKOUT_OPEN' or created_at > now() - interval '1 day'
     order by created_at desc limit 200`,
  );
  const requests = await db.query(
    `select r.id, r.order_id, r.description, r.decision, r.created_at, r.decided_at,
       coalesce(json_agg(json_build_object('id', p.id, 'mime', p.mime, 'size', p.byte_size, 'at', p.created_at, 'purged', p.purged_at is not null))
         filter (where p.id is not null), '[]') as photos
     from store_reprint_requests r left join store_claim_photos p on p.request_id = r.id
     group by r.id order by r.created_at desc limit 100`,
  );
  const now = await deps.now();
  return {
    env: deps.config.env,
    ordersEnabled: (await getSetting(db, "ORDERS_ENABLED")) === "true",
    maxOrdersPerDay: deps.config.dailyOrderCap,
    maxExposureUsdPerDay: deps.config.dailyDollarCap,
    copies: await copiesLeft(db, deps.config, now),
    clockOverride: deps.config.env === "sbx" ? ((await getSetting(db, "clock_override")) ?? null) : null,
    cap: await capCheck(db, now, 0, deps.config),
    photoBytes: await totalPhotoBytes(db),
    orders,
    requests,
  };
}

type Act = { action: string; orderId?: string; requestId?: string; value?: string; maxOverride?: boolean };

export async function adminAction(deps: StoreDeps, a: Act): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = deps.db;
  const load = async () => {
    const [o] = await db.query<OrderRow>("select * from store_orders where id = $1", [a.orderId]);
    return o;
  };
  switch (a.action) {
    case "set-enabled":
      await setSetting(db, "ORDERS_ENABLED", a.value === "true" ? "true" : "false");
      await audit(db, null, "admin", `ORDERS_ENABLED=${a.value}`);
      return { status: 200, body: { ok: true } };
    case "release": {
      const o = await load();
      if (o?.state !== "HELD") return { status: 409, body: { error: "not HELD" } };
      return { status: 200, body: { result: await rpiCreate(deps, o.id, "admin") } };
    }
    case "cancel-refund": {
      const o = await load();
      if (!o) return { status: 404, body: {} };
      return requestCancel(deps, o, "admin", { maxOverride: !!a.maxOverride });
    }
    case "resolve": {
      const o = await load();
      const to = a.value as State;
      if (!o || o.state !== "NEEDS_ATTENTION" || !STATES.includes(to)) return { status: 409, body: { error: "bad resolve" } };
      await transition(db, o.id, to, "admin", "resolved by Max");
      return { status: 200, body: { ok: true } };
    }
    case "approve-reprint":
    case "decline-reprint": {
      const o = await load();
      if (o?.state !== "REPRINT_REQUESTED") return { status: 409, body: { error: "not REPRINT_REQUESTED" } };
      const approve = a.action === "approve-reprint";
      await db.query("update store_reprint_requests set decision = $2, decided_at = $3 where order_id = $1 and decision is null", [o.id, approve ? "approved" : "declined", (await deps.now()).toISOString()]);
      await transition(db, o.id, approve ? "REPRINT_APPROVED" : "REPRINT_DECLINED", "admin");
      if (!approve) await sendReprintDeclined(deps, o);
      return {
        status: 200,
        body: approve
          ? { ok: true, reminder: "Contact RPI Customer Support within 30 days of receipt for a replacement; if they decline, use 'Place replacement order'." }
          : { ok: true },
      };
    }
    case "replacement-order": {
      const o = await load();
      if (o?.state !== "REPRINT_APPROVED") return { status: 409, body: { error: "approve the reprint first" } };
      const body = buildCreateBody(deps, o, customerOrderIdFor(deps.config.env, o.stripe_session_id, "-rp1"));
      const res = await deps.rpi.create(body);
      await audit(db, o.id, "admin", `replacement order ${res.kind === "ok" ? "created" : "failed"}`);
      return { status: res.kind === "ok" ? 200 : 502, body: { result: res.kind === "ok" ? "created" : "failed", status: "status" in res ? res.status : null } };
    }
    case "replacement-shipped": {
      const o = await load();
      if (o?.state !== "REPRINT_APPROVED") return { status: 409, body: { error: "not REPRINT_APPROVED" } };
      if (a.value) await db.query("update store_orders set tracking_json = $2 where id = $1", [o.id, JSON.stringify({ trackingUrl: a.value })]);
      await transition(db, o.id, "REPRINT_SHIPPED", "admin");
      await sendShipped(deps, (await load())!, true);
      return { status: 200, body: { ok: true } };
    }
    case "test-emails": {
      const fake: OrderRow = {
        id: "TESTTESTtoken", state: "PAID", email: deps.config.alertTo, ship_name: "Test Buyer", ship_method: "standard",
        amount_total_cents: 21649, cancel_deadline_utc: new Date().toISOString(),
        ship_address_json: JSON.stringify({ line1: "1 Test St", city: "Chico", state: "CA", postal_code: "95926" }),
      };
      const m = confirmationEmail(deps, fake);
      await sendAlert(deps, "Test: confirmation email", `${m.subject}\n\n${m.text}`);
      await sendShipped(deps, { ...fake, tracking_json: JSON.stringify({ trackingNumber: "TEST123", carrier: "UPS", trackingUrl: "https://example.com/track" }) });
      return { status: 200, body: { ok: true, to: "ALERT_EMAIL_TO" } };
    }
    case "rpi-ping": {
      const r = await deps.rpi.list({ limit: 10 });
      const items = r.kind === "ok" ? (r.body?.orders ?? r.body?.data ?? r.body?.items ?? r.body ?? []) : [];
      return { status: 200, body: { httpStatus: "status" in r ? r.status : 0, count: Array.isArray(items) ? items.length : null } };
    }
    case "clock-override": {
      if (deps.config.env !== "sbx") return { status: 404, body: {} };
      if (a.value) {
        if (Number.isNaN(Date.parse(a.value))) return { status: 400, body: { error: "bad time" } };
        await setSetting(db, "clock_override", new Date(a.value).toISOString());
      } else await db.query("delete from store_settings where key = 'clock_override'");
      return { status: 200, body: { ok: true } };
    }
    case "drop-next-rpi-webhook": {
      if (deps.config.env !== "sbx") return { status: 404, body: {} };
      await setSetting(db, "SBX_DROP_NEXT_RPI_WEBHOOK", "true");
      return { status: 200, body: { ok: true } };
    }
    default:
      return { status: 400, body: { error: "unknown action" } };
  }
}
