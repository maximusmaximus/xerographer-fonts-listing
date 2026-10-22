-- Limited edition of 500. One row per reserved or sold copy; the primary key (1..500) makes
-- overselling impossible even under concurrent checkouts. Additive only.
create table if not exists store_edition_copies (
  copy_no integer primary key check (copy_no between 1 and 500),
  order_id text not null references store_orders(id),
  expires_at timestamptz,                 -- null once paid; reservation expiry otherwise
  created_at timestamptz not null default now()
);
create unique index if not exists store_edition_copies_order_idx on store_edition_copies (order_id);
alter table store_orders add column if not exists edition_number integer;
-- Daily cap now 50 copies per PT day; lift the old $750 RPI-exposure default to fit it.
update store_settings set value = '8000' where key = 'MAX_RPI_EXPOSURE_USD_PER_DAY' and value = '750';
update store_settings set value = '50' where key = 'MAX_RPI_ORDERS_PER_DAY' and value = '5';
-- Sales ship OFF: only the admin toggle turns them on.
update store_settings set value = 'false' where key = 'ORDERS_ENABLED';
