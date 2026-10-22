-- Older deploys created store_orders before these columns existed.
-- Additive only. A no-op when the current 0003 already created them.
alter table store_orders add column if not exists env text;
alter table store_orders add column if not exists alerted_stuck_at timestamptz;
