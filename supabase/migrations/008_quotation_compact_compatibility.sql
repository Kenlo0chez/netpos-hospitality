-- Compatibility fields used by the compact quotation workspace.  Keep the
-- original quote_number column in sync because older quotation workflows and
-- reports still use it.
alter table public.quotations
  add column if not exists quotation_number text,
  add column if not exists room_type_id uuid references public.room_types(id),
  add column if not exists room_id uuid references public.rooms(id),
  add column if not exists vat_rate numeric(5,2) not null default 15.00;

create unique index if not exists quotations_quotation_number_key
  on public.quotations (quotation_number)
  where quotation_number is not null;

create or replace function public.netpos_sync_quotation_numbers()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  generated_number text;
begin
  generated_number := 'QUO-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS') ||
    '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  new.quote_number := coalesce(nullif(new.quote_number, ''), nullif(new.quotation_number, ''), generated_number);
  new.quotation_number := coalesce(nullif(new.quotation_number, ''), new.quote_number);
  return new;
end;
$$;

drop trigger if exists quotations_sync_numbers on public.quotations;
create trigger quotations_sync_numbers
before insert or update of quote_number, quotation_number
on public.quotations
for each row execute function public.netpos_sync_quotation_numbers();

update public.quotations
set quotation_number = quote_number
where quotation_number is null;
