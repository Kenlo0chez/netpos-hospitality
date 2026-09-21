-- ============================================================
-- NETPOS HOSPITALITY
-- Immutable End-of-Day snapshots and automatic audit trail
-- ============================================================

create table if not exists public.end_of_day_snapshots (
  id uuid primary key default gen_random_uuid(),
  trading_day_id uuid not null unique references public.trading_days(id),
  property_id uuid not null references public.properties(id),
  business_date date not null,
  closed_at timestamptz not null,
  closed_by uuid references public.profiles(id),
  cash_total numeric(12,2) not null default 0,
  card_total numeric(12,2) not null default 0,
  eft_total numeric(12,2) not null default 0,
  account_total numeric(12,2) not null default 0,
  gross_payments numeric(12,2) not null default 0,
  refunds_total numeric(12,2) not null default 0,
  net_total numeric(12,2) not null default 0,
  transaction_count integer not null default 0,
  cancellation_count integer not null default 0,
  transactions jsonb not null default '[]'::jsonb,
  cancellations jsonb not null default '[]'::jsonb,
  snapshot_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_eod_snapshots_property_date
  on public.end_of_day_snapshots(property_id, business_date desc);

alter table public.end_of_day_snapshots enable row level security;

drop policy if exists "eod snapshots read by scope"
  on public.end_of_day_snapshots;
create policy "eod snapshots read by scope"
on public.end_of_day_snapshots for select to authenticated
using (public.netpos_can_manage_finance(property_id));

revoke insert, update, delete, truncate
  on public.end_of_day_snapshots from anon, authenticated;
grant select on public.end_of_day_snapshots to authenticated, service_role;

create or replace function public.netpos_prevent_snapshot_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'End-of-Day snapshots are permanent and cannot be changed or deleted.';
end;
$$;

drop trigger if exists protect_end_of_day_snapshots
  on public.end_of_day_snapshots;
create trigger protect_end_of_day_snapshots
before update or delete on public.end_of_day_snapshots
for each row execute function public.netpos_prevent_snapshot_change();

create or replace function public.netpos_audit_critical_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb;
  new_row jsonb;
  audit_property_id uuid;
  audit_entity_id uuid;
begin
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  audit_property_id := coalesce(
    nullif(new_row ->> 'property_id', '')::uuid,
    nullif(old_row ->> 'property_id', '')::uuid
  );
  audit_entity_id := coalesce(
    nullif(new_row ->> 'id', '')::uuid,
    nullif(old_row ->> 'id', '')::uuid
  );

  insert into public.audit_logs (
    property_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    reason
  ) values (
    audit_property_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    audit_entity_id,
    old_row,
    new_row,
    'Automatic system audit'
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'payments',
    'reservations',
    'invoices',
    'finance_entries'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'drop trigger if exists audit_%I_changes on public.%I',
        table_name,
        table_name
      );
      execute format(
        'create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function public.netpos_audit_critical_change()',
        table_name,
        table_name
      );
    end if;
  end loop;
end;
$$;

create or replace function public.netpos_protect_closed_day_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  protected_day_id uuid;
  protected_status text;
begin
  protected_day_id := case when tg_op = 'DELETE'
    then old.trading_day_id else old.trading_day_id end;

  select status into protected_status
  from public.trading_days
  where id = protected_day_id;

  if protected_status = 'closed' then
    raise exception 'Payments belonging to a closed business day cannot be changed or deleted. Record a refund or correction in the current day.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_closed_day_payment on public.payments;
create trigger protect_closed_day_payment
before update or delete on public.payments
for each row execute function public.netpos_protect_closed_day_payment();

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
  snapshot_transactions jsonb;
  snapshot_cancellations jsonb;
  snapshot_totals jsonb;
  snapshot_closed_at timestamptz := now();
begin
  select * into current_day
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'received_at', p.received_at,
    'reservation_id', p.reservation_id,
    'reservation_number', r.reservation_number,
    'guest', trim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')),
    'room', coalesce(room_data.room_number, '-'),
    'payment_reference', p.payment_reference,
    'payment_method', p.payment_method,
    'transaction_type', p.transaction_type,
    'amount', p.amount,
    'notes', p.notes
  ) order by p.received_at), '[]'::jsonb)
  into snapshot_transactions
  from public.payments p
  left join public.reservations r on r.id = p.reservation_id
  left join public.guests g on g.id = coalesce(p.guest_id, r.guest_id)
  left join lateral (
    select rm.room_number
    from public.reservation_rooms rr
    left join public.rooms rm on rm.id = rr.room_id
    where rr.reservation_id = r.id
    order by rr.created_at
    limit 1
  ) room_data on true
  where p.trading_day_id = current_day.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'reservation_number', r.reservation_number,
    'guest', trim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')),
    'cancelled_at', r.cancelled_at,
    'status', r.status
  ) order by r.cancelled_at), '[]'::jsonb)
  into snapshot_cancellations
  from public.reservations r
  left join public.guests g on g.id = r.guest_id
  where r.cancelled_trading_day_id = current_day.id;

  select jsonb_build_object(
    'cash_total', coalesce(sum(case when payment_method = 'cash' then case when transaction_type = 'refund' then -amount else amount end else 0 end), 0),
    'card_total', coalesce(sum(case when payment_method = 'card' then case when transaction_type = 'refund' then -amount else amount end else 0 end), 0),
    'eft_total', coalesce(sum(case when payment_method = 'eft' then case when transaction_type = 'refund' then -amount else amount end else 0 end), 0),
    'account_total', coalesce(sum(case when payment_method = 'account' then case when transaction_type = 'refund' then -amount else amount end else 0 end), 0),
    'gross_payments', coalesce(sum(case when transaction_type <> 'refund' then amount else 0 end), 0),
    'refunds_total', coalesce(sum(case when transaction_type = 'refund' then amount else 0 end), 0),
    'net_total', coalesce(sum(case when transaction_type = 'refund' then -amount else amount end), 0),
    'transaction_count', count(*)
  ) into snapshot_totals
  from public.payments
  where trading_day_id = current_day.id;

  insert into public.end_of_day_snapshots (
    trading_day_id, property_id, business_date, closed_at, closed_by,
    cash_total, card_total, eft_total, account_total,
    gross_payments, refunds_total, net_total,
    transaction_count, cancellation_count,
    transactions, cancellations, snapshot_hash
  ) values (
    current_day.id, current_day.property_id, current_day.business_date,
    snapshot_closed_at, auth.uid(),
    (snapshot_totals ->> 'cash_total')::numeric,
    (snapshot_totals ->> 'card_total')::numeric,
    (snapshot_totals ->> 'eft_total')::numeric,
    (snapshot_totals ->> 'account_total')::numeric,
    (snapshot_totals ->> 'gross_payments')::numeric,
    (snapshot_totals ->> 'refunds_total')::numeric,
    (snapshot_totals ->> 'net_total')::numeric,
    (snapshot_totals ->> 'transaction_count')::integer,
    jsonb_array_length(snapshot_cancellations),
    snapshot_transactions,
    snapshot_cancellations,
    md5(snapshot_totals::text || snapshot_transactions::text || snapshot_cancellations::text)
  );

  update public.trading_days
  set status = 'closed', closed_at = snapshot_closed_at
  where id = current_day.id;

  insert into public.audit_logs (
    property_id, user_id, action, entity_type, entity_id,
    new_values, reason
  ) values (
    current_day.property_id, auth.uid(), 'close', 'trading_days', current_day.id,
    jsonb_build_object(
      'business_date', current_day.business_date,
      'snapshot_hash', md5(snapshot_totals::text || snapshot_transactions::text || snapshot_cancellations::text)
    ),
    'End of Day completed'
  );

  insert into public.trading_days (property_id, business_date, status)
  values (current_day.property_id, current_day.business_date + 1, 'open')
  on conflict (property_id, business_date) do nothing
  returning * into next_day;

  if next_day.id is null then
    select * into next_day
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
