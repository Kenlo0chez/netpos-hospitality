-- ============================================================
-- NETPOS HOSPITALITY
-- Atomic End-of-Day processing
-- ============================================================

-- A property may have exactly one active trading day. This protects against
-- double-clicks, concurrent reception sessions and interrupted requests.
create unique index if not exists trading_days_one_open_per_property
  on public.trading_days (property_id)
  where status = 'open';

create or replace function public.netpos_end_of_day(
  p_trading_day_id uuid
)
returns public.trading_days
language plpgsql
security definer
set search_path = public
as $$
declare
  current_day public.trading_days;
  next_day public.trading_days;
  staff_role text;
begin
  select *
    into current_day
  from public.trading_days
  where id = p_trading_day_id
  for update;

  if not found then
    raise exception 'Trading day not found.';
  end if;

  if current_day.status <> 'open' then
    raise exception 'This trading day has already been closed.';
  end if;

  staff_role := public.netpos_current_staff_role();

  if staff_role not in ('owner', 'manager', 'reception')
    or not public.netpos_can_access_property(current_day.property_id)
  then
    raise exception 'You do not have permission to complete End of Day.';
  end if;

  update public.trading_days
  set
    status = 'closed',
    closed_at = now()
  where id = current_day.id;

  insert into public.trading_days (
    property_id,
    business_date,
    status
  )
  values (
    current_day.property_id,
    current_day.business_date + 1,
    'open'
  )
  on conflict (property_id, business_date) do nothing
  returning * into next_day;

  if next_day.id is null then
    select *
      into next_day
    from public.trading_days
    where property_id = current_day.property_id
      and business_date = current_day.business_date + 1
    for update;

    if next_day.id is null or next_day.status <> 'open' then
      raise exception 'The next business day already exists and is closed.';
    end if;
  end if;

  return next_day;
end;
$$;

revoke all on function public.netpos_end_of_day(uuid) from public;
grant execute on function public.netpos_end_of_day(uuid)
  to authenticated, service_role;

