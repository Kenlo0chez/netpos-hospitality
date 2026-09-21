-- Short, concurrency-safe document numbers for new quotations and invoices.
-- Existing document numbers remain unchanged for audit history.
create sequence if not exists public.netpos_quotation_number_seq;
create sequence if not exists public.netpos_invoice_number_seq;

select setval(
  'public.netpos_quotation_number_seq',
  greatest(
    coalesce((
      select max(substring(coalesce(quotation_number, quote_number) from '[0-9]+$')::bigint)
      from public.quotations
      where coalesce(quotation_number, quote_number) ~ '^QTE[0-9]+$'
    ), 0) + 1,
    1
  ),
  false
);

select setval(
  'public.netpos_invoice_number_seq',
  greatest(
    coalesce((
      select max(substring(invoice_number from '[0-9]+$')::bigint)
      from public.invoices
      where invoice_number ~ '^INV[0-9]+$'
    ), 0) + 1,
    1
  ),
  false
);

create or replace function public.netpos_sync_quotation_numbers()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  generated_number text;
begin
  if new.quote_number is null
     or new.quote_number = ''
     or new.quote_number ~ '^(QUO|QTE)-[0-9]{8}' then
    generated_number := 'QTE' || nextval('public.netpos_quotation_number_seq');
  else
    generated_number := new.quote_number;
  end if;

  new.quote_number := generated_number;
  new.quotation_number := generated_number;
  return new;
end;
$$;

create or replace function public.netpos_assign_invoice_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.invoice_number is null
     or new.invoice_number = ''
     or new.invoice_number ~ '^INV-[0-9]{8}' then
    new.invoice_number := 'INV' || nextval('public.netpos_invoice_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_assign_short_number on public.invoices;
create trigger invoices_assign_short_number
before insert on public.invoices
for each row execute function public.netpos_assign_invoice_number();

grant usage, select on sequence public.netpos_quotation_number_seq
  to authenticated, service_role;
grant usage, select on sequence public.netpos_invoice_number_seq
  to authenticated, service_role;
