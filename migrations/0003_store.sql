-- Specimen Ledger book store (Stripe Checkout -> RPI print-on-demand).
-- Every table is prefixed store_ so nothing collides with licenses / x402 / auth.

create table if not exists store_orders (
  id text primary key,                         -- site order token (128-bit random, URL-safe)
  env text not null check (env in ('sbx', 'prod')),
  state text not null,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  customer_order_id text unique,
  rpi_attempt integer not null default 0,
  rpi_status text,
  rpi_next_retry_at timestamptz,
  rpi_first_sent_at timestamptz,
  ship_method text,
  ship_name text,
  ship_address_json text,
  email text,
  phone text,
  amount_total_cents integer,
  amount_tax_cents integer,
  amount_shipping_cents integer,
  paid_at timestamptz,
  cancel_deadline_utc timestamptz,
  deferred_until_utc timestamptz,
  cancel_requested_at timestamptz,
  locked_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  tracking_json text,
  risk_level text,
  last_error text,
  alerted_stuck_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_orders_state_idx on store_orders (state);

create table if not exists store_stripe_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

create table if not exists store_rpi_events (
  body_sha256 text primary key,
  customer_order_id text,
  source text,
  received_at timestamptz not null default now()
);

create table if not exists store_cron_runs (
  path text not null,
  ts bigint not null,
  primary key (path, ts)
);

create table if not exists store_reprint_requests (
  id text primary key,
  order_id text not null references store_orders(id),
  description text not null,
  photo_refs_json text,
  decision text,
  rpi_reference text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists store_claim_photos (
  id text primary key,
  request_id text not null references store_reprint_requests(id) on delete cascade,
  order_id text not null references store_orders(id),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 3145728),
  sha256 text not null,
  data bytea,
  created_at timestamptz not null default now(),
  purged_at timestamptz,
  unique (request_id, sha256)
);

create table if not exists store_settings (
  key text primary key,
  value text not null
);
insert into store_settings (key, value) values
  ('ORDERS_ENABLED', 'true'),
  ('MAX_RPI_ORDERS_PER_DAY', '5'),
  ('MAX_RPI_EXPOSURE_USD_PER_DAY', '750')
on conflict (key) do nothing;

create table if not exists store_audit (
  id bigserial primary key,
  order_id text,
  from_state text,
  to_state text,
  actor text not null,
  note text,
  at timestamptz not null default now()
);
create index if not exists store_audit_order_idx on store_audit (order_id, at);
