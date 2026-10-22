-- Public book copy, edited from /admin. Does not touch licenses or store orders.
create table if not exists site_products (
  id text primary key,
  title text not null,
  specs text not null,
  description text not null,
  price_label text not null,
  price_note text not null,
  listed boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into site_products (id, title, specs, description, price_label, price_note, listed)
values (
  'specimen-ledger',
  'Xerographer Specimen Ledger',
  '530-page hardcover · 11.75 × 11.75 in · full color on 100# gloss · ImageWrap cover',
  'Every Xerographer face, set and printed: the full catalog of 1,376 original typefaces drawn since 2012 — eroded, cartoon, script, horror, stencil and the rest of the photocopy cabinet — gathered into one oversized specimen ledger.',
  '$250',
  'plus shipping at cost and sales tax',
  true
)
on conflict (id) do nothing;
