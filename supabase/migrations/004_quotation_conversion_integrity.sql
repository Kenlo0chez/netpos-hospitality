-- Prevent two concurrent conversion attempts from creating two reservations
-- for the same quotation. Existing unconverted reservations are unaffected.
create unique index if not exists idx_reservations_unique_quotation
  on reservations (quotation_id)
  where quotation_id is not null;
