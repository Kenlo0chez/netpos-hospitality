-- NETPOS HOSPITALITY: shared cashbook batch drafts

create table if not exists public.finance_batch_drafts (
    property_id uuid primary key references public.properties(id) on delete cascade,
    rows jsonb not null default '[]'::jsonb,
    created_by uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.finance_batch_drafts enable row level security;

grant select, insert, update, delete on table public.finance_batch_drafts to authenticated;
revoke all on table public.finance_batch_drafts from anon;

create policy "finance users can read permitted batch drafts"
on public.finance_batch_drafts for select to authenticated
using (
    exists (
        select 1 from public.staff_users staff
        where staff.auth_user_id = auth.uid()
          and staff.is_active = true
          and staff.role in ('owner','manager')
          and (staff.role = 'owner' or staff.property_id = finance_batch_drafts.property_id)
    )
);

create policy "finance users can create permitted batch drafts"
on public.finance_batch_drafts for insert to authenticated
with check (
    created_by = auth.uid()
    and exists (
        select 1 from public.staff_users staff
        where staff.auth_user_id = auth.uid()
          and staff.is_active = true
          and staff.role in ('owner','manager')
          and (staff.role = 'owner' or staff.property_id = finance_batch_drafts.property_id)
    )
);

create policy "finance users can update permitted batch drafts"
on public.finance_batch_drafts for update to authenticated
using (
    exists (
        select 1 from public.staff_users staff
        where staff.auth_user_id = auth.uid()
          and staff.is_active = true
          and staff.role in ('owner','manager')
          and (staff.role = 'owner' or staff.property_id = finance_batch_drafts.property_id)
    )
)
with check (
    exists (
        select 1 from public.staff_users staff
        where staff.auth_user_id = auth.uid()
          and staff.is_active = true
          and staff.role in ('owner','manager')
          and (staff.role = 'owner' or staff.property_id = finance_batch_drafts.property_id)
    )
);

create policy "finance users can delete permitted batch drafts"
on public.finance_batch_drafts for delete to authenticated
using (
    exists (
        select 1 from public.staff_users staff
        where staff.auth_user_id = auth.uid()
          and staff.is_active = true
          and staff.role in ('owner','manager')
          and (staff.role = 'owner' or staff.property_id = finance_batch_drafts.property_id)
    )
);
