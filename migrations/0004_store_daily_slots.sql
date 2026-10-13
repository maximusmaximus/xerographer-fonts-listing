-- Daily copy slots for the book store. One row per sold or reserved copy per cap day
-- (cap day starts at 02:00 UTC, matching RPI's nightly charge). The primary key makes it
-- impossible for two buyers to take the same (last) slot.
create table if not exists store_daily_slots (
  day text not null,                      -- cap-window start, ISO date-time
  slot integer not null,
  order_id text not null references store_orders(id),
  expires_at timestamptz,                 -- null once paid; reservation expiry otherwise
  primary key (day, slot)
);
create unique index if not exists store_daily_slots_order_idx on store_daily_slots (order_id);
