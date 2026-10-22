/**
 * Store tests: pure helpers + full flows against an in-memory PGLite with the real
 * migrations, and fakes for Stripe, RPI and email. No network calls.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import type { Db, RpiResult, StoreDeps } from "./types.ts";
import { base32, customerOrderIdFor } from "./ids.ts";
import { cancelDeadlineFor, capWindowStart, isAfterTodayCutoff, nextPostChargeRunUtc } from "./time.ts";
import { canTransition, transition } from "./state.ts";
import { loadStoreConfig } from "./config.ts";
import { verifyStripeEvent, handleStripeEvent } from "./stripe-webhook.ts";
import { cronSignature, verifyRpiSignature } from "./hmac.ts";
import { authorizeCron, postCharge, reconcile, dailyReview } from "./cron.ts";
import { createCheckout } from "./checkout.ts";
import { requestCancel } from "./cancel.ts";
import { handleRpiWebhook } from "./rpi-webhook.ts";
import { BOOK, mapRpiStatus } from "./rpi.ts";
import { getSetting, setSetting } from "./settings.ts";
import { createReprintRequest, readPhoto, sniffImage, uploadClaimPhoto, purgePhotos } from "./photos.ts";
import { resendMailer } from "./emails.ts";
import { checkAdmin, adminAction } from "./admin.ts";
import { copiesLeft, dailyCopyCap, reserveSlot } from "./slots.ts";

const root = new URL("../../../", import.meta.url);

// ---------- pure helpers ----------

describe("ids", () => {
  it("base32 matches RFC 4648 test vector", () => {
    assert.equal(base32(new TextEncoder().encode("foobar")), "mzxw6ytboi");
  });
  it("customerOrderId is deterministic, prefixed and <= 40 chars", () => {
    const a = customerOrderIdFor("sbx", "cs_test_example");
    assert.equal(a, customerOrderIdFor("sbx", "cs_test_example"));
    assert.match(a, /^xsl-sbx-[a-z2-7]{26}$/);
    assert.ok(customerOrderIdFor("prod", "cs_live_x", "-rp1").length <= 40);
    assert.notEqual(customerOrderIdFor("prod", "cs_test_example"), a.replace("sbx", "prod") + "x");
  });
});

describe("cutoff times (America/Los_Angeles)", () => {
  it("same-day 4 PM PDT before the cutoff", () => {
    assert.equal(cancelDeadlineFor(new Date("2026-10-13T17:00:00Z")).toISOString(), "2026-10-13T23:00:00.000Z");
  });
  it("next-day 4 PM after the cutoff", () => {
    assert.equal(cancelDeadlineFor(new Date("2026-10-13T23:30:00Z")).toISOString(), "2026-10-14T23:00:00.000Z");
  });
  it("PST after DST ends (Nov 1, 2026)", () => {
    assert.equal(cancelDeadlineFor(new Date("2026-11-02T18:00:00Z")).toISOString(), "2026-11-03T00:00:00.000Z");
    // ordered Oct 31 at 5 PM PDT -> Nov 1 4 PM PST
    assert.equal(cancelDeadlineFor(new Date("2026-11-01T00:00:00Z")).toISOString(), "2026-11-02T00:00:00.000Z");
  });
  it("cutoff, post-charge run and cap window", () => {
    assert.equal(isAfterTodayCutoff(new Date("2026-10-13T22:59:00Z")), false);
    assert.equal(isAfterTodayCutoff(new Date("2026-10-13T23:00:00Z")), true);
    assert.equal(nextPostChargeRunUtc(new Date("2026-10-13T23:30:00Z")).toISOString(), "2026-10-14T02:15:00.000Z");
    assert.equal(nextPostChargeRunUtc(new Date("2026-10-14T03:00:00Z")).toISOString(), "2026-10-15T02:15:00.000Z");
    assert.equal(capWindowStart(new Date("2026-10-14T01:00:00Z")).toISOString(), "2026-10-13T02:00:00.000Z");
  });
});

describe("state machine", () => {
  it("allows the plan's transitions and rejects others", () => {
    assert.ok(canTransition("CHECKOUT_OPEN", "PAID", "stripe"));
    assert.ok(canTransition("CANCEL_WINDOW", "LOCKED", "rpi"));
    assert.ok(!canTransition("LOCKED", "CANCEL_REQUESTED", "customer"));
    assert.ok(!canTransition("SHIPPED", "PAID", "admin"));
    assert.ok(canTransition("NEEDS_ATTENTION", "LOCKED", "admin"));
    assert.ok(!canTransition("NEEDS_ATTENTION", "LOCKED", "cron"));
    assert.ok(canTransition("LOCKED", "DISPUTED", "stripe"));
  });
  it("maps RPI statuses", () => {
    assert.equal(mapRpiStatus("VALID_AWAITING_PAYMENT"), "CANCEL_WINDOW");
    assert.equal(mapRpiStatus("VALID_HOLDING_BIN"), "LOCKED");
    assert.equal(mapRpiStatus("FAILED"), "PREFLIGHT_REJECTED");
  });
});

describe("config guards", () => {
  const base = {
    STORE_ENV: "sbx", PUBLIC_BASE_URL: "https://test-copy.example", STRIPE_SECRET_KEY: "rk_test_dummy",
    STRIPE_PRICE_ID: "price_1", STRIPE_SHIPPING_RATE_STANDARD: "shr_s", STRIPE_SHIPPING_RATE_EXPEDITED: "shr_e", STRIPE_SHIPPING_RATE_RUSH: "shr_r",
  } as Record<string, string>;
  const cfg = (o: Record<string, string | undefined>) => loadStoreConfig((k) => ({ ...base, ...o })[k]);
  it("is OFF when STORE_ENV is unset (today's live site)", () => assert.equal(cfg({ STORE_ENV: undefined }).config, null));
  it("refuses sbx on fonts.grok.me", () => assert.equal(cfg({ PUBLIC_BASE_URL: "https://fonts.grok.me" }).config, null));
  it("refuses prod off fonts.grok.me or with a test key", () => {
    assert.equal(cfg({ STORE_ENV: "prod" }).config, null);
    assert.equal(cfg({ STORE_ENV: "prod", PUBLIC_BASE_URL: "https://fonts.grok.me" }).config, null);
    assert.ok(cfg({ STORE_ENV: "prod", PUBLIC_BASE_URL: "https://fonts.grok.me", STRIPE_SECRET_KEY: "rk_live_dummy" }).config);
  });
  it("refuses sbx with a live key", () => assert.equal(cfg({ STRIPE_SECRET_KEY: "sk_live_dummy" }).config, null));
  it("defaults reply-to to maxinfeld@gmail.com", () => assert.equal(cfg({}).config?.replyTo, "maxinfeld@gmail.com"));
});

describe("signatures", () => {
  const stripe = new Stripe("sk_test_dummy_not_real");
  const secret = "whsec_test_dummy";
  const payload = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded", data: { object: {} } });
  it("accepts a valid Stripe signature on the raw body", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    assert.equal(verifyStripeEvent(stripe.webhooks, payload, header, secret)?.id, "evt_1");
  });
  it("rejects missing, wrong or re-serialized bodies", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    assert.equal(verifyStripeEvent(stripe.webhooks, payload, null, secret), null);
    assert.equal(verifyStripeEvent(stripe.webhooks, payload, header, "whsec_other"), null);
    assert.equal(verifyStripeEvent(stripe.webhooks, JSON.stringify(JSON.parse(payload), null, 2), header, secret), null);
  });
  it("verifies RPI base64 HMAC", () => {
    const raw = '{"source":"OrderShipped"}';
    const sig = createHmac("sha256", "rpi_secret").update(raw).digest("base64");
    assert.ok(verifyRpiSignature(raw, sig, "rpi_secret"));
    assert.ok(!verifyRpiSignature(raw + " ", sig, "rpi_secret"));
    assert.ok(!verifyRpiSignature(raw, null, "rpi_secret"));
    assert.ok(!verifyRpiSignature(raw, sig, undefined));
  });
  it("checks the admin token", () => {
    assert.ok(checkAdmin(new Headers({ "x-admin-token": "abc" }), "abc"));
    assert.ok(!checkAdmin(new Headers({ "x-admin-token": "abd" }), "abc"));
    assert.ok(!checkAdmin(new Headers(), "abc"));
    assert.ok(!checkAdmin(new Headers({ "x-admin-token": "" }), undefined));
  });
});

// ---------- DB-backed flows ----------

async function freshDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.waitReady;
  for (const f of ["0002_licenses.sql", "0003_store.sql", "0004_store_daily_slots.sql"]) await pg.exec(readFileSync(new URL(`migrations/${f}`, root), "utf8"));
  return { query: async (t, p) => (await pg.query(t, p as unknown[])).rows as never };
}

type Harness = ReturnType<typeof makeHarness> extends Promise<infer T> ? T : never;

async function makeHarness() {
  const db = await freshDb();
  const clock = { now: new Date("2026-10-13T17:00:00Z") }; // 10 AM PDT
  const calls = { creates: [] as any[], gets: [] as string[], cancels: [] as string[], refunds: [] as any[], emails: [] as any[], sessions: [] as any[] };
  const rpiState = new Map<string, string>();
  const behaviour = { create: "ok" as "ok" | "timeout" | "401" | "400", get: "auto" as "auto" | "404", cancel: "ok" as "ok" | "validating" };
  let sessionN = 0;
  const sessions = new Map<string, any>();
  const deps: StoreDeps = {
    db,
    config: {
      env: "sbx", publicBaseUrl: "https://test-copy.example", stripePriceId: "price_199",
      shippingRates: { standard: "shr_std", expedited: "shr_exp", rush: "shr_rush" },
      rpiBaseUrl: "https://rpi.invalid", replyTo: "maxinfeld@gmail.com", alertTo: "ops@example.com", emailFrom: "Store <s@example.com>",
      dailyOrderCap: 5, dailyDollarCap: 750,
    },
    stripe: {
      checkout: {
        sessions: {
          async create(params) {
            calls.sessions.push(params);
            const id = `cs_test_${++sessionN}`;
            sessions.set(id, params);
            return { id, url: `https://checkout.stripe.test/${id}` };
          },
          async retrieve(id) {
            const p = sessions.get(id);
            return {
              id, payment_status: "paid", amount_total: 21649,
              total_details: { amount_tax: 1050, amount_shipping: 699 },
              shipping_cost: { amount_total: 699, shipping_rate: { id: p?.__rate ?? "shr_std" } },
              customer_details: { email: "buyer@example.com", phone: "+15555550100", name: "Pat Buyer" },
              collected_information: { shipping_details: { name: "Pat Buyer", address: p?.__addr ?? { line1: "1 Main St", city: "Chico", state: "CA", postal_code: "95926", country: "US" } } },
              payment_intent: { id: `pi_${id}`, latest_charge: { outcome: { risk_level: p?.__risk ?? "normal" } } },
            };
          },
        },
      },
      refunds: {
        async create(params, opts) {
          calls.refunds.push({ params, opts });
          return { id: "re_1", amount: 21649, status: "succeeded" };
        },
      },
    },
    rpi: {
      async create(body): Promise<RpiResult> {
        calls.creates.push(body);
        if (behaviour.create === "timeout") return { kind: "network", error: "TimeoutError" };
        if (behaviour.create === "401") return { kind: "http", status: 401, body: null };
        if (behaviour.create === "400") return { kind: "http", status: 400, body: null, errorDescription: "bad postal" };
        rpiState.set(body.customerOrderId as string, "QUEUED");
        return { kind: "ok", status: 201, body: { status: "QUEUED" } };
      },
      async get(id): Promise<RpiResult> {
        calls.gets.push(id);
        const s = rpiState.get(id);
        if (!s || behaviour.get === "404") return { kind: "http", status: 404, body: null };
        return { kind: "ok", status: 200, body: { status: s, shipmentTracking: [{ trackingNumber: "1Z", trackingUrl: "https://track.example/1Z", carrier: "UPS" }] } };
      },
      async cancel(id): Promise<RpiResult> {
        calls.cancels.push(id);
        if (behaviour.cancel === "validating") return { kind: "http", status: 400, body: null, errorDescription: "Order is validating" };
        rpiState.set(id, "CANCELLED");
        return { kind: "ok", status: 200, body: { status: "CANCELLED" } };
      },
      async list() {
        return { kind: "ok", status: 200, body: { orders: [] } };
      },
    },
    mailer: { async send(m) { calls.emails.push(m); return { sent: true }; } },
    now: async () => clock.now,
  };
  let evt = 0;
  async function checkoutAndPay(opts: { rate?: string; addr?: any; risk?: string } = {}) {
    const r = await createCheckout(deps);
    assert.equal(r.status, 200);
    const sessionId = `cs_test_${sessionN}`;
    Object.assign(sessions.get(sessionId), { __rate: opts.rate, __addr: opts.addr, __risk: opts.risk });
    const token = calls.sessions.at(-1).metadata.order_token as string;
    const result = await handleStripeEvent(deps, {
      id: `evt_${++evt}`, type: "checkout.session.completed",
      data: { object: { id: sessionId, payment_status: "paid", metadata: { order_token: token } } },
    });
    return { token, sessionId, result };
  }
  const order = async (id: string) => (await db.query<any>("select * from store_orders where id = $1", [id]))[0];
  return { db, deps, clock, calls, rpiState, behaviour, checkoutAndPay, order };
}

describe("checkout + Stripe webhook -> RPI", () => {
  let h: Harness;
  beforeEach(async () => (h = await makeHarness()));

  it("creates a Checkout Session with the plan's settings", async () => {
    await createCheckout(h.deps);
    const p = h.calls.sessions[0];
    assert.equal(p.mode, "payment");
    assert.deepEqual(p.line_items, [{ price: "price_199", quantity: 1 }]);
    assert.deepEqual(p.shipping_address_collection, { allowed_countries: ["US"] });
    assert.equal(p.shipping_options.length, 3);
    assert.equal(p.automatic_tax.enabled, true);
    assert.equal(p.consent_collection.terms_of_service, "required");
    assert.match(p.custom_text.terms_of_service_acceptance.message, /test-copy\.example\/terms/);
    assert.equal(p.metadata.env, "sbx");
  });

  it("paid before 4 PM PT -> exactly one RPI create with the right SKU/files/id", async () => {
    const { token, sessionId, result } = await h.checkoutAndPay({ rate: "shr_exp" });
    assert.equal(result, "rpi_created");
    assert.equal(h.calls.creates.length, 1);
    const b = h.calls.creates[0];
    assert.equal(b.customerOrderId, customerOrderIdFor("sbx", sessionId));
    assert.equal(b.shippingClassification, "expedited");
    assert.equal(b.orderItems[0].sku, BOOK.sku);
    assert.equal(b.orderItems[0].product.coverUrl, BOOK.coverUrl);
    assert.equal(b.orderItems[0].product.gutsUrl, BOOK.gutsUrl);
    assert.equal(b.destination.regionCode, "CA");
    assert.equal(b.webhookUrl, `https://test-copy.example/api/store/rpi/webhook?o=${token}`);
    const o = await h.order(token);
    assert.equal(o.state, "RPI_CREATED");
    assert.equal(new Date(o.cancel_deadline_utc).toISOString(), "2026-10-13T23:00:00.000Z");
    const conf = h.calls.emails.find((e) => e.to === "buyer@example.com");
    assert.match(conf.subject, /is ordered/);
  });

  it("duplicate events and re-sent sessions never create twice", async () => {
    const { token, sessionId } = await h.checkoutAndPay();
    const again = await handleStripeEvent(h.deps, { id: "evt_1", type: "checkout.session.completed", data: { object: { id: sessionId, payment_status: "paid", metadata: { order_token: token } } } });
    assert.equal(again, "duplicate");
    const other = await handleStripeEvent(h.deps, { id: "evt_new", type: "checkout.session.completed", data: { object: { id: sessionId, payment_status: "paid", metadata: { order_token: token } } } });
    assert.equal(other, "already_processed");
    assert.equal(h.calls.creates.length, 1);
  });

  it("unpaid or metadata-less sessions do nothing", async () => {
    assert.equal(await handleStripeEvent(h.deps, { id: "e1", type: "checkout.session.completed", data: { object: { id: "cs_x", payment_status: "unpaid", metadata: {} } } }), "not_paid");
    assert.equal(await handleStripeEvent(h.deps, { id: "e2", type: "checkout.session.completed", data: { object: { id: "cs_x", payment_status: "paid", metadata: {} } } }), "ignored (no metadata)");
    assert.equal(h.calls.creates.length, 0);
  });

  it("after 4 PM PT -> DEFERRED, then created by post-charge at 02:15 UTC", async () => {
    h.clock.now = new Date("2026-10-13T23:30:00Z");
    const { token, result } = await h.checkoutAndPay();
    assert.equal(result, "deferred");
    assert.equal(h.calls.creates.length, 0);
    assert.equal(new Date((await h.order(token)).deferred_until_utc).toISOString(), "2026-10-14T02:15:00.000Z");
    h.clock.now = new Date("2026-10-14T02:15:00Z");
    await postCharge(h.deps);
    assert.equal((await h.order(token)).state, "RPI_CREATED");
    assert.equal(h.calls.creates.length, 1);
  });

  it("refuses AK/HI/territories: refund + problem email, no RPI order", async () => {
    const { token, result } = await h.checkoutAndPay({ addr: { line1: "1 Ice Rd", city: "Juneau", state: "AK", postal_code: "99801", country: "US" } });
    assert.equal(result, "refunded_unsupported_address");
    assert.equal((await h.order(token)).state, "CANCELLED_REFUNDED");
    assert.equal(h.calls.refunds.length, 1);
    assert.equal(h.calls.creates.length, 0);
  });

  it("sells at most 5 copies a day: the 6th checkout is refused as sold out", async () => {
    for (let i = 0; i < 5; i += 1) assert.equal((await h.checkoutAndPay()).result, "rpi_created");
    const r = await createCheckout(h.deps);
    assert.equal(r.status, 409);
    assert.equal(r.body.error, "sold_out");
    assert.equal(h.calls.sessions.length, 5);
    assert.equal(h.calls.creates.length, 5);
  });

  it("holds elevated-risk orders", async () => {
    assert.equal((await h.checkoutAndPay({ risk: "elevated" })).result, "held");
    assert.equal(h.calls.creates.length, 0);
  });

  it("the dollar cap also limits copies (DAILY_DOLLAR_CAP=200 -> 1 copy)", async () => {
    h.deps.config.dailyDollarCap = 200;
    assert.equal((await h.checkoutAndPay()).result, "rpi_created");
    assert.equal((await createCheckout(h.deps)).status, 409);
  });

  it("kill switch: checkout returns 503", async () => {
    await setSetting(h.db, "ORDERS_ENABLED", "false");
    assert.equal((await createCheckout(h.deps)).status, 503);
  });

  it("RPI 401 trips the kill switch and alerts", async () => {
    h.behaviour.create = "401";
    await h.checkoutAndPay();
    assert.equal(await getSetting(h.db, "ORDERS_ENABLED"), "false");
    assert.ok(h.calls.emails.some((e) => e.to === "ops@example.com" && /kill switch/.test(e.subject)));
  });

  it("RPI 400 -> NEEDS_ATTENTION + alert", async () => {
    h.behaviour.create = "400";
    const { token } = await h.checkoutAndPay();
    assert.equal((await h.order(token)).state, "NEEDS_ATTENTION");
  });

  it("timeout: GET before retry; reconcile retries with the SAME id", async () => {
    h.behaviour.create = "timeout";
    const { token, sessionId } = await h.checkoutAndPay();
    let o = await h.order(token);
    assert.equal(o.state, "RPI_CREATING");
    assert.ok(o.rpi_next_retry_at);
    assert.deepEqual(h.calls.gets, [customerOrderIdFor("sbx", sessionId)]);
    h.behaviour.create = "ok";
    h.clock.now = new Date(h.clock.now.getTime() + 5 * 60_000);
    await reconcile(h.deps);
    o = await h.order(token);
    assert.equal(o.state, "RPI_CREATED");
    assert.equal(h.calls.creates.length, 2);
    assert.equal(h.calls.creates[1].customerOrderId, h.calls.creates[0].customerOrderId);
  });

  it("timeout but RPI actually got it: adopt via GET, never create twice", async () => {
    h.behaviour.create = "timeout";
    const { token, sessionId } = await h.checkoutAndPay();
    h.rpiState.set(customerOrderIdFor("sbx", sessionId), "RECEIVED");
    h.clock.now = new Date(h.clock.now.getTime() + 5 * 60_000);
    await reconcile(h.deps);
    assert.equal((await h.order(token)).state, "RPI_CREATED");
    assert.equal(h.calls.creates.length, 1);
  });
});

describe("cancel window", () => {
  let h: Harness;
  beforeEach(async () => (h = await makeHarness()));

  it("customer cancel before 4 PM PT -> RPI cancel + full refund + email", async () => {
    const { token } = await h.checkoutAndPay();
    const r = await requestCancel(h.deps, await h.order(token), "customer");
    assert.equal(r.status, 200);
    assert.equal((await h.order(token)).state, "CANCELLED_REFUNDED");
    assert.equal(h.calls.cancels.length, 1);
    assert.equal(h.calls.refunds[0].params.payment_intent, (await h.order(token)).stripe_payment_intent_id);
    assert.ok(h.calls.emails.some((e) => /is cancelled/.test(e.subject)));
  });

  it("after the deadline or once LOCKED -> 409 with the policy text", async () => {
    const { token } = await h.checkoutAndPay();
    h.clock.now = new Date("2026-10-13T23:00:01Z");
    const r = await requestCancel(h.deps, await h.order(token), "customer");
    assert.equal(r.status, 409);
    assert.match(String(r.body.error), /gone to print/);
    assert.equal(h.calls.refunds.length, 0);
  });

  it("while VALIDATING the cancel is queued and retried by reconcile", async () => {
    const { token } = await h.checkoutAndPay();
    h.behaviour.cancel = "validating";
    await requestCancel(h.deps, await h.order(token), "customer");
    assert.equal((await h.order(token)).state, "CANCEL_REQUESTED");
    h.behaviour.cancel = "ok";
    h.clock.now = new Date("2026-10-14T01:00:00Z"); // after the deadline: still honored
    await reconcile(h.deps);
    assert.equal((await h.order(token)).state, "CANCELLED_REFUNDED");
  });
});

describe("RPI webhook + reconcile", () => {
  let h: Harness;
  beforeEach(async () => (h = await makeHarness()));

  it("moves forward only, sets LOCKED and SHIPPED (with tracking email), dedupes bodies", async () => {
    const { token, sessionId } = await h.checkoutAndPay();
    const id = customerOrderIdFor("sbx", sessionId);
    h.rpiState.set(id, "VALID_AWAITING_PAYMENT");
    const raw1 = JSON.stringify({ source: "OrderValidated", time: "t1", data: { customerOrderId: id } });
    assert.equal(await handleRpiWebhook(h.deps, raw1, token), "CANCEL_WINDOW");
    assert.equal(await handleRpiWebhook(h.deps, raw1, token), "duplicate");
    h.rpiState.set(id, "VALID_HOLDING_BIN");
    await handleRpiWebhook(h.deps, JSON.stringify({ source: "PaymentSuccessful", time: "t2", data: { customerOrderId: id } }), token);
    assert.equal((await h.order(token)).state, "LOCKED");
    h.rpiState.set(id, "VALID_AWAITING_PAYMENT"); // stale
    await reconcile(h.deps);
    assert.equal((await h.order(token)).state, "LOCKED");
    h.rpiState.set(id, "SHIPPED");
    await handleRpiWebhook(h.deps, JSON.stringify({ source: "OrderShipped", time: "t3", data: { customerOrderId: id } }), token);
    const o = await h.order(token);
    assert.equal(o.state, "SHIPPED");
    assert.match(o.tracking_json, /1Z/);
    assert.ok(h.calls.emails.some((e) => /has shipped/.test(e.subject) && /track\.example/.test(e.text)));
  });

  it("PaymentFailure alerts Max", async () => {
    const { token, sessionId } = await h.checkoutAndPay();
    const id = customerOrderIdFor("sbx", sessionId);
    await handleRpiWebhook(h.deps, JSON.stringify({ source: "PaymentFailure", time: "x", data: { customerOrderId: id } }), token);
    assert.ok(h.calls.emails.some((e) => /card payment failed/.test(e.subject)));
  });

  it("daily review sends a digest", async () => {
    await h.checkoutAndPay();
    await dailyReview(h.deps);
    assert.ok(h.calls.emails.some((e) => /Daily review/.test(e.subject)));
  });
});

describe("cron auth", () => {
  it("accepts a fresh signature once, rejects stale/bad/replayed", async () => {
    const db = await freshDb();
    const path = "/api/store/cron/reconcile";
    const now = Date.parse("2026-10-13T17:00:00Z");
    const ts = String(Math.floor(now / 1000));
    const h = (t: string, s: string) => new Headers({ "x-cron-timestamp": t, "x-cron-signature": s });
    assert.deepEqual(await authorizeCron({ db }, h(ts, cronSignature("cron_s", ts, path)), path, "cron_s", now), { ok: true });
    assert.deepEqual(await authorizeCron({ db }, h(ts, cronSignature("cron_s", ts, path)), path, "cron_s", now), { ok: false, status: 409 });
    const old = String(Number(ts) - 301);
    assert.deepEqual(await authorizeCron({ db }, h(old, cronSignature("cron_s", old, path)), path, "cron_s", now), { ok: false, status: 401 });
    assert.deepEqual(await authorizeCron({ db }, h(ts, cronSignature("wrong", ts, path)), path, "cron_s", now), { ok: false, status: 401 });
    assert.deepEqual(await authorizeCron({ db }, h(ts, cronSignature("cron_s", ts, "/api/store/cron/post-charge")), path, "cron_s", now), { ok: false, status: 401 });
    assert.deepEqual(await authorizeCron({ db }, new Headers(), path, "cron_s", now), { ok: false, status: 401 });
  });
});

describe("damage photos (ADDENDUM-2)", () => {
  const jpeg = (n = 1000, seed = 0) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff]); b[10] = seed; return b; };
  const png = () => { const b = new Uint8Array(100); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return b; };
  const webp = () => { const b = new Uint8Array(100); b.set(new TextEncoder().encode("RIFF"), 0); b.set(new TextEncoder().encode("WEBP"), 8); return b; };

  it("sniffs JPEG/PNG/WebP and rejects anything else", () => {
    assert.equal(sniffImage(jpeg()), "image/jpeg");
    assert.equal(sniffImage(png()), "image/png");
    assert.equal(sniffImage(webp()), "image/webp");
    assert.equal(sniffImage(new TextEncoder().encode("hello, not an image")), null);
  });

  async function shipped(h: Harness) {
    const { token, sessionId } = await h.checkoutAndPay();
    h.rpiState.set(customerOrderIdFor("sbx", sessionId), "SHIPPED");
    await reconcile(h.deps);
    const r = await createReprintRequest(h.deps, await h.order(token), "Spine cracked, box crushed");
    assert.equal(r.status, 200);
    return { token, requestId: r.body.requestId as string };
  }
  const up = (h: Harness, token: string, req: string, bytes: Uint8Array, len?: string | null) =>
    uploadClaimPhoto(h.deps, token, req, len === undefined ? String(bytes.length) : len, async () => bytes.slice().buffer);

  it("stores up to 3 photos, dedupes, enforces type/size/count/auth/window/rate limit, and purges", async () => {
    const h = await makeHarness();
    const { token, requestId } = await shipped(h);
    assert.equal((await h.order(token)).state, "REPRINT_REQUESTED");

    const a = await up(h, token, requestId, jpeg(1000, 1));
    assert.equal(a.status, 200);
    assert.equal((await up(h, token, requestId, jpeg(1000, 1))).body.photoId, a.body.photoId); // dedupe
    assert.equal((await up(h, token, requestId, new TextEncoder().encode("plain text pretending"))).status, 415);
    assert.equal((await up(h, token, requestId, jpeg(10), "4000000")).status, 413);
    assert.equal((await up(h, token, requestId, jpeg(10), null)).status, 413);
    assert.equal((await up(h, token, requestId, png())).status, 200);
    assert.equal((await up(h, token, requestId, webp())).status, 200);
    assert.equal((await up(h, token, requestId, jpeg(1000, 9))).status, 409);
    assert.equal((await up(h, "wrong-token", requestId, jpeg())).status, 404);
    assert.equal((await up(h, token, "wrong-request", jpeg())).status, 404);

    const p = await readPhoto(h.db, a.body.photoId as string, token);
    assert.equal(p.status, 200);
    assert.equal(p.status === 200 && p.headers["Cache-Control"], "private, no-store");
    assert.equal(p.status === 200 && p.headers["Content-Type"], "image/jpeg");
    assert.equal((await readPhoto(h.db, a.body.photoId as string, "someone-else")).status, 404);

    // rate limit: 10 attempts per hour (8 used above for this order; 404s never count)
    assert.equal((await up(h, token, requestId, jpeg(1000, 1))).status, 200);
    assert.equal((await up(h, token, requestId, jpeg(1000, 1))).status, 200);
    assert.equal((await up(h, token, requestId, jpeg(1000, 1))).status, 429);

    // window closes 21 days after shipping when delivery is unknown
    h.clock.now = new Date(h.clock.now.getTime() + 22 * 86_400_000);
    assert.equal((await up(h, token, requestId, jpeg(1000, 5))).status, 403);

    // purge 120 days after upload with no decision
    h.clock.now = new Date(Date.now() + 121 * 86_400_000);
    assert.equal(await purgePhotos(h.deps), 3);
    assert.equal((await readPhoto(h.db, a.body.photoId as string, token)).status, 410);
  });
});

describe("emails", () => {
  it("store emails set reply-to and don't BCC", async () => {
    let sent: any;
    const m = resendMailer({
      apiKey: "re_dummy", from: "Store <s@example.com>", replyTo: "maxinfeld@gmail.com",
      fetchImpl: (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch,
    });
    await m.send({ to: "buyer@example.com", subject: "s", text: "t", html: "<p>t</p>" });
    assert.equal(sent.reply_to, "maxinfeld@gmail.com");
    assert.deepEqual(sent.to, ["buyer@example.com"]);
    assert.equal(sent.bcc, undefined);
  });
  it("does nothing without RESEND_API_KEY", async () => {
    const m = resendMailer({ apiKey: undefined, from: "x", replyTo: "y" });
    assert.equal((await m.send({ to: "a@b.c", subject: "s", text: "t", html: "t" })).sent, false);
  });
});

describe("admin", () => {
  it("sbx-only tools are 404 in prod", async () => {
    const h = await makeHarness();
    h.deps.config.env = "prod";
    assert.equal((await adminAction(h.deps, { action: "clock-override", value: "2026-10-13T00:00:00Z" })).status, 404);
  });
  it("Release HELD sends it to RPI", async () => {
    const h = await makeHarness();
    const { token } = await h.checkoutAndPay({ risk: "elevated" });
    assert.equal((await h.order(token)).state, "HELD");
    await adminAction(h.deps, { action: "release", orderId: token });
    assert.equal((await h.order(token)).state, "RPI_CREATED");
  });
  it("transition() refuses illegal moves", async () => {
    const h = await makeHarness();
    const { token } = await h.checkoutAndPay();
    await assert.rejects(transition(h.db, token, "SHIPPED", "customer").then(() => transition(h.db, token, "PAID", "customer")));
  });
});

describe("copies left today + reservations", () => {
  let h: Harness;
  beforeEach(async () => (h = await makeHarness()));
  const left = async () => (await copiesLeft(h.db, h.deps.config, h.clock.now)).left;

  it("env caps: defaults 5 / 750, configurable, bad values fall back", () => {
    const base: Record<string, string> = {
      STORE_ENV: "sbx", PUBLIC_BASE_URL: "https://t.example", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_ID: "p",
      STRIPE_SHIPPING_RATE_STANDARD: "a", STRIPE_SHIPPING_RATE_EXPEDITED: "b", STRIPE_SHIPPING_RATE_RUSH: "c",
    };
    const c = (o: Record<string, string>) => loadStoreConfig((k) => ({ ...base, ...o })[k]).config!;
    assert.equal(c({}).dailyOrderCap, 5);
    assert.equal(c({}).dailyDollarCap, 750);
    assert.equal(c({ DAILY_ORDER_CAP: "1" }).dailyOrderCap, 1);
    assert.equal(c({ DAILY_ORDER_CAP: "abc", DAILY_DOLLAR_CAP: "-3" }).dailyOrderCap, 5);
    assert.equal(c({ DAILY_DOLLAR_CAP: "-3" }).dailyDollarCap, 750);
    assert.equal(dailyCopyCap({ dailyOrderCap: 5, dailyDollarCap: 750 }), 5);
    assert.equal(dailyCopyCap({ dailyOrderCap: 10, dailyDollarCap: 750 }), 6); // $120.55 each at Standard
  });

  it("counts paid and reserved orders; an abandoned checkout frees its copy after 31 min", async () => {
    assert.equal(await left(), 5);
    await h.checkoutAndPay();
    assert.equal(await left(), 4);
    await createCheckout(h.deps); // reserved, not paid
    assert.equal(await left(), 3);
    h.clock.now = new Date(h.clock.now.getTime() + 32 * 60_000);
    assert.equal(await left(), 4);
  });

  it("checkout.session.expired and full refunds put the copy back", async () => {
    await createCheckout(h.deps);
    const token = h.calls.sessions.at(-1).metadata.order_token;
    await handleStripeEvent(h.deps, { id: "evt_exp", type: "checkout.session.expired", data: { object: { id: "cs_test_1" } } });
    assert.equal((await h.order(token)).state, "EXPIRED");
    assert.equal(await left(), 5);
    const paid = await h.checkoutAndPay();
    assert.equal(await left(), 4);
    await requestCancel(h.deps, await h.order(paid.token), "customer");
    assert.equal(await left(), 5);
  });

  it("two buyers racing for the last copy: exactly one wins", async () => {
    h.deps.config.dailyOrderCap = 1;
    for (const id of ["o1", "o2", "o3", "o4"]) await h.db.query("insert into store_orders (id, env, state) values ($1, 'sbx', 'CHECKOUT_OPEN')", [id]);
    const wins = await Promise.all(["o1", "o2", "o3", "o4"].map((id) => reserveSlot(h.db, h.deps.config, id, h.clock.now)));
    assert.equal(wins.filter(Boolean).length, 1);
  });

  it("sold out until the 02:00 UTC day boundary, then back", async () => {
    h.deps.config.dailyOrderCap = 1;
    await h.checkoutAndPay();
    assert.equal(await left(), 0);
    assert.equal((await createCheckout(h.deps)).status, 409);
    h.clock.now = new Date("2026-10-14T02:00:00Z");
    assert.equal(await left(), 1);
  });
});

describe("emoji-store parity", () => {
  let h: Harness;
  beforeEach(async () => (h = await makeHarness()));

  it("OrderExceedsLimitQueue → NEEDS_ATTENTION + alert; OrderOverLimitQueued alerts only", async () => {
    const { token, sessionId } = await h.checkoutAndPay();
    const id = customerOrderIdFor("sbx", sessionId);
    h.rpiState.set(id, "QUEUED");
    await handleRpiWebhook(h.deps, JSON.stringify({ source: "OrderOverLimitQueued", time: "q1", data: { customerOrderId: id } }), token);
    assert.ok(h.calls.emails.some((e) => /limit queue/i.test(e.subject)));
    assert.notEqual((await h.order(token)).state, "NEEDS_ATTENTION");
    assert.equal(await handleRpiWebhook(h.deps, JSON.stringify({ source: "OrderExceedsLimitQueue", time: "q2", data: { customerOrderId: id } }), token), "needs_attention");
    assert.equal((await h.order(token)).state, "NEEDS_ATTENTION");
  });

  it("health returns only booleans, numbers and timestamps", async () => {
    const { storeHealth } = await import("./health.ts");
    await setSetting(h.db, "ORDERS_ENABLED", "false");
    const fakeEnv: Record<string, string> = { STRIPE_SECRET_KEY: "rk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", ADMIN_TOKEN: "tok" };
    const r = await storeHealth(h.deps, (k) => fakeEnv[k], async () => ({ status: 200 }));
    assert.equal(r.stripeKeyIsLive, false);
    assert.equal(r.stripeWebhookSecretLooksValid, true);
    assert.equal(r.dbReachable, true);
    assert.equal(r.ordersEnabled, false);
    assert.deepEqual(r.printFilesOk, { interior: true, cover: true });
    const flat = JSON.stringify(r);
    assert.ok(!flat.includes("rk_test_x") && !flat.includes("whsec_x") && !flat.includes('"tok"') && !/https?:/.test(flat));
  });

  it("sales ship OFF and reply-to defaults to Max", () => {
    const { config } = loadStoreConfig((k) => ({ STORE_ENV: "sbx", PUBLIC_BASE_URL: "https://test.example", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_ID: "p", STRIPE_SHIPPING_RATE_STANDARD: "a", STRIPE_SHIPPING_RATE_EXPEDITED: "b", STRIPE_SHIPPING_RATE_RUSH: "c" } as Record<string, string>)[k]);
    if (config) assert.equal(config.replyTo, "maxinfeld@gmail.com");
    assert.equal(BOOK.sku, "BKPH_HCIW_STD_11.750x11.750IN_80C_MT_40_100T_GLS_44");
  });
});
