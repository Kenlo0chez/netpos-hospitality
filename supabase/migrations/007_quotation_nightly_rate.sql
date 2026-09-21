-- Store the quoted room rate on the quotation header.  The quotations UI
-- reads this value when printing and when converting a quote to a booking.
alter table public.quotations
  add column if not exists nightly_rate numeric(12,2) not null default 0;

comment on column public.quotations.nightly_rate is
  'VAT-inclusive nightly accommodation rate captured when the quotation is created.';
