/**
 * Wires the store to real services. Server-only: every secret is read here via env.server.ts
 * and handed to clients in memory; nothing is logged or sent to the browser.
 */
import Stripe from "stripe";
import { env } from "../env.server";
import { getSql } from "../db";
import type { StoreDeps } from "./types";
import { loadStoreConfig } from "./config";
import { httpRpiClient } from "./rpi";
import { resendMailer } from "./emails";
import { getSetting } from "./settings";

export const STRIPE_API_VERSION = "2025-10-29.clover";

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  stripeClient ??= new Stripe(env("STRIPE_SECRET_KEY") ?? "", { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 1, timeout: 8000 });
  return stripeClient;
}

/** null => store is off; routes answer 404. */
export async function storeDeps(): Promise<StoreDeps | null> {
  const { config } = loadStoreConfig(env);
  if (!config) return null;
  const db = await getSql();
  const log = (m: string) => console.log(m);
  return {
    db,
    config,
    stripe: stripe() as unknown as StoreDeps["stripe"],
    rpi: httpRpiClient({ baseUrl: config.rpiBaseUrl, auth: env("RPI_API_AUTH"), log }),
    mailer: resendMailer({ apiKey: env("RESEND_API_KEY"), from: config.emailFrom, replyTo: config.replyTo }),
    async now() {
      if (config.env === "sbx") {
        const o = await getSetting(db, "clock_override");
        if (o && !Number.isNaN(Date.parse(o))) return new Date(o);
      }
      return new Date();
    },
    log,
  };
}

export function stripeWebhooks() {
  return stripe().webhooks;
}

export const secrets = {
  stripeWebhook: () => env("STRIPE_WEBHOOK_SECRET"),
  rpiWebhook: () => env("RPI_WEBHOOK_SECRET"),
  cron: () => env("CRON_SECRET"),
  admin: () => env("ADMIN_TOKEN"),
};

export const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...headers } });
