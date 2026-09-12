create table if not exists licenses (
  id text primary key,
  font_slug text not null,
  font_name text not null,
  payer_id text not null,
  email text,
  licensee_name text,
  amount_usd numeric not null default 45,
  network text not null default 'base',
  asset text not null default 'USDC',
  tx_hash text,
  payment_payload jsonb,
  payment_response jsonb,
  receipt jsonb not null,
  emailed_to text,
  email_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists licenses_font_payer_idx
  on licenses (font_slug, payer_id);

create index if not exists licenses_created_at_idx
  on licenses (created_at desc);
