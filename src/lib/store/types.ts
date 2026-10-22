/** Shared types for the Specimen Ledger store. Server-only code paths. */

/** The subset of the app's `Sql` surface (src/lib/db.ts) the store uses. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export type StoreEnv = "sbx" | "prod";
export type ShipMethod = "standard" | "expedited" | "rush";

export interface StoreConfig {
  env: StoreEnv;
  publicBaseUrl: string;
  stripePriceId: string;
  shippingRates: Record<ShipMethod, string>;
  rpiBaseUrl: string;
  replyTo: string;
  alertTo: string | undefined;
  emailFrom: string;
  dailyOrderCap: number;
  dailyDollarCap: number;
}

export interface Mailer {
  send(msg: { to: string; subject: string; text: string; html: string }): Promise<{ sent: boolean; error?: string }>;
}

/** Minimal Stripe surface (the official SDK satisfies it; tests pass a fake). */
export interface StripeLike {
  checkout: {
    sessions: {
      create(params: Record<string, unknown>, opts?: { idempotencyKey?: string }): Promise<{ id: string; url: string | null }>;
      retrieve(id: string, params?: Record<string, unknown>): Promise<Record<string, any>>;
    };
  };
  refunds: {
    create(params: Record<string, unknown>, opts?: { idempotencyKey?: string }): Promise<{ id: string; amount: number; status: string | null }>;
  };
  paymentIntents?: {
    retrieve(id: string, params?: Record<string, unknown>): Promise<Record<string, any>>;
  };
}

export interface RpiClient {
  create(body: Record<string, unknown>): Promise<RpiResult>;
  get(customerOrderId: string): Promise<RpiResult>;
  cancel(customerOrderId: string): Promise<RpiResult>;
  list(params: { limit: number; offset?: number; status?: string }): Promise<RpiResult>;
}

export type RpiResult =
  | { kind: "ok"; status: number; body: any }
  | { kind: "http"; status: number; body: any; errorDescription?: string }
  | { kind: "network"; error: string };

export interface StoreDeps {
  db: Db;
  config: StoreConfig;
  stripe: StripeLike;
  rpi: RpiClient;
  mailer: Mailer;
  /** Current time (sbx may apply clock_override; prod never does). */
  now(): Promise<Date>;
  log?(msg: string): void;
}
