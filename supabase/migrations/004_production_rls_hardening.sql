-- ============================================================
-- NETPOS HOSPITALITY
-- Production RLS and property-isolation hardening
-- ============================================================

-- All helpers deliberately read the authenticated staff record through a
-- SECURITY DEFINER function so policies do not recurse through staff_users.
create or replace function public.netpos_can_access_property(requested_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_users staff
    where staff.auth_user_id = auth.uid()
      and staff.is_active = true
      and (
        lower(staff.role) = 'owner'
        or staff.property_id = requested_property_id
      )
  );
$$;

create or replace function public.netpos_can_manage_finance(requested_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_users staff
    where staff.auth_user_id = auth.uid()
      and staff.is_active = true
      and lower(staff.role) in ('owner', 'manager')
      and (
        lower(staff.role) = 'owner'
        or staff.property_id = requested_property_id
      )
  );
$$;

create or replace function public.netpos_can_manage_housekeeping(requested_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_users staff
    where staff.auth_user_id = auth.uid()
      and staff.is_active = true
      and lower(staff.role) in ('owner', 'manager', 'housekeeping')
      and (
        lower(staff.role) = 'owner'
        or staff.property_id = requested_property_id
      )
  );
$$;

create or replace function public.netpos_can_use_guest_operations(requested_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_users staff
    where staff.auth_user_id = auth.uid()
      and staff.is_active = true
      and lower(staff.role) in ('owner', 'manager', 'reception')
      and (
        lower(staff.role) = 'owner'
        or staff.property_id = requested_property_id
      )
  );
$$;

revoke all on function public.netpos_can_access_property(uuid) from public;
revoke all on function public.netpos_can_manage_finance(uuid) from public;
revoke all on function public.netpos_can_manage_housekeeping(uuid) from public;
revoke all on function public.netpos_can_use_guest_operations(uuid) from public;
grant execute on function public.netpos_can_access_property(uuid) to authenticated, service_role;
grant execute on function public.netpos_can_manage_finance(uuid) to authenticated, service_role;
grant execute on function public.netpos_can_manage_housekeeping(uuid) to authenticated, service_role;
grant execute on function public.netpos_can_use_guest_operations(uuid) to authenticated, service_role;

-- RLS must also cover child tables and logs; otherwise a user can bypass the
-- parent policy by querying the child table directly.
alter table public.audit_logs enable row level security;
alter table public.housekeeping_tasks enable row level security;
alter table public.invoice_items enable row level security;
alter table public.quotation_items enable row level security;
alter table public.receipts enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.profiles enable row level security;
alter table public.user_properties enable row level security;

drop policy if exists "audit logs read by scope" on public.audit_logs;
create policy "audit logs read by scope"
on public.audit_logs for select to authenticated
using (public.netpos_can_manage_finance(property_id));

drop policy if exists "audit logs create by scope" on public.audit_logs;
create policy "audit logs create by scope"
on public.audit_logs for insert to authenticated
with check (
  user_id = auth.uid()
  and public.netpos_can_access_property(property_id)
);

drop policy if exists "housekeeping tasks read by scope" on public.housekeeping_tasks;
create policy "housekeeping tasks read by scope"
on public.housekeeping_tasks for select to authenticated
using (public.netpos_can_manage_housekeeping(property_id));

drop policy if exists "housekeeping tasks create by scope" on public.housekeeping_tasks;
create policy "housekeeping tasks create by scope"
on public.housekeeping_tasks for insert to authenticated
with check (public.netpos_can_manage_housekeeping(property_id));

drop policy if exists "housekeeping tasks update by scope" on public.housekeeping_tasks;
create policy "housekeeping tasks update by scope"
on public.housekeeping_tasks for update to authenticated
using (public.netpos_can_manage_housekeeping(property_id))
with check (public.netpos_can_manage_housekeeping(property_id));

drop policy if exists "invoice items read by invoice scope" on public.invoice_items;
create policy "invoice items read by invoice scope"
on public.invoice_items for select to authenticated
using (exists (
  select 1 from public.invoices parent
  where parent.id = invoice_items.invoice_id
    and public.netpos_can_use_guest_operations(parent.property_id)
));

drop policy if exists "invoice items write by invoice scope" on public.invoice_items;
create policy "invoice items write by invoice scope"
on public.invoice_items for all to authenticated
using (exists (
  select 1 from public.invoices parent
  where parent.id = invoice_items.invoice_id
    and public.netpos_can_use_guest_operations(parent.property_id)
))
with check (exists (
  select 1 from public.invoices parent
  where parent.id = invoice_items.invoice_id
    and public.netpos_can_use_guest_operations(parent.property_id)
));

drop policy if exists "quotation items read by quotation scope" on public.quotation_items;
create policy "quotation items read by quotation scope"
on public.quotation_items for select to authenticated
using (exists (
  select 1 from public.quotations parent
  where parent.id = quotation_items.quotation_id
    and public.netpos_can_use_guest_operations(parent.property_id)
));

drop policy if exists "quotation items write by quotation scope" on public.quotation_items;
create policy "quotation items write by quotation scope"
on public.quotation_items for all to authenticated
using (exists (
  select 1 from public.quotations parent
  where parent.id = quotation_items.quotation_id
    and public.netpos_can_use_guest_operations(parent.property_id)
))
with check (exists (
  select 1 from public.quotations parent
  where parent.id = quotation_items.quotation_id
    and public.netpos_can_use_guest_operations(parent.property_id)
));

drop policy if exists "receipts read by scope" on public.receipts;
create policy "receipts read by scope"
on public.receipts for select to authenticated
using (public.netpos_can_use_guest_operations(property_id));

drop policy if exists "receipts write by scope" on public.receipts;
create policy "receipts write by scope"
on public.receipts for all to authenticated
using (public.netpos_can_use_guest_operations(property_id))
with check (public.netpos_can_use_guest_operations(property_id));

drop policy if exists "whatsapp messages read by scope" on public.whatsapp_messages;
create policy "whatsapp messages read by scope"
on public.whatsapp_messages for select to authenticated
using (public.netpos_can_use_guest_operations(property_id));

drop policy if exists "whatsapp messages create by scope" on public.whatsapp_messages;
create policy "whatsapp messages create by scope"
on public.whatsapp_messages for insert to authenticated
with check (public.netpos_can_use_guest_operations(property_id));

drop policy if exists "whatsapp messages update by scope" on public.whatsapp_messages;
create policy "whatsapp messages update by scope"
on public.whatsapp_messages for update to authenticated
using (public.netpos_can_use_guest_operations(property_id))
with check (public.netpos_can_use_guest_operations(property_id));

drop policy if exists "profiles self or owner read" on public.profiles;
create policy "profiles self or owner read"
on public.profiles for select to authenticated
using (id = auth.uid() or public.netpos_is_owner());

drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update"
on public.profiles for update to authenticated
using (public.netpos_is_owner())
with check (public.netpos_is_owner());

drop policy if exists "user properties read by scope" on public.user_properties;
create policy "user properties read by scope"
on public.user_properties for select to authenticated
using (
  user_id = auth.uid()
  or public.netpos_is_owner()
  or public.netpos_can_manage_finance(property_id)
);

drop policy if exists "user properties owner write" on public.user_properties;
create policy "user properties owner write"
on public.user_properties for all to authenticated
using (public.netpos_is_owner())
with check (public.netpos_is_owner());

-- Replace permissive finance policies that previously used USING (true).
drop policy if exists "Authenticated staff manage bank accounts" on public.bank_accounts;
create policy "finance staff manage bank accounts"
on public.bank_accounts for all to authenticated
using (public.netpos_can_manage_finance(property_id))
with check (public.netpos_can_manage_finance(property_id));

drop policy if exists "Authenticated staff manage reconciliations" on public.bank_reconciliations;
create policy "finance staff manage reconciliations"
on public.bank_reconciliations for all to authenticated
using (public.netpos_can_manage_finance(property_id))
with check (public.netpos_can_manage_finance(property_id));

drop policy if exists "Authenticated staff manage statement imports" on public.bank_statement_imports;
create policy "finance staff manage statement imports"
on public.bank_statement_imports for all to authenticated
using (public.netpos_can_manage_finance(property_id))
with check (public.netpos_can_manage_finance(property_id));

drop policy if exists "Authenticated staff manage statement lines" on public.bank_statement_lines;
create policy "finance staff manage statement lines"
on public.bank_statement_lines for all to authenticated
using (public.netpos_can_manage_finance(property_id))
with check (public.netpos_can_manage_finance(property_id));

drop policy if exists "Authenticated staff manage expense categories" on public.expense_categories;
create policy "finance staff manage expense categories"
on public.expense_categories for all to authenticated
using (public.netpos_can_manage_finance(property_id))
with check (public.netpos_can_manage_finance(property_id));

drop policy if exists "Authenticated staff manage expenses" on public.expenses;
create policy "finance staff manage expenses"
on public.expenses for all to authenticated
using (public.netpos_can_manage_finance(property_id))
with check (public.netpos_can_manage_finance(property_id));

drop policy if exists "Authenticated staff manage payment allocations" on public.payment_allocations;
create policy "finance staff manage payment allocations"
on public.payment_allocations for all to authenticated
using (public.netpos_can_manage_finance(property_id))
with check (public.netpos_can_manage_finance(property_id));

drop policy if exists "Authenticated staff manage payouts" on public.payouts;
create policy "finance staff manage payouts"
on public.payouts for all to authenticated
using (public.netpos_can_manage_finance(property_id))
with check (public.netpos_can_manage_finance(property_id));

-- TRUNCATE does not use row-level security. It must never be available to a
-- normal signed-in user, even on tables where they can insert or update rows.
revoke truncate on all tables in schema public from authenticated;
revoke all on all tables in schema public from anon;
