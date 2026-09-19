-- NETPOS HOSPITALITY: finance, payouts and bank reconciliation

create table if not exists finance_entries (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id) on delete cascade,
    entry_date date not null default current_date,
    entry_type text not null check (entry_type in ('income','expense','payout')),
    category text not null,
    description text not null,
    payment_method text not null check (payment_method in ('cash','card','eft','account')),
    reference text,
    amount numeric(12,2) not null check (amount > 0),
    vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0),
    bank_status text not null default 'unmatched'
        check (bank_status in ('unmatched','matched','excluded')),
    bank_reference text,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_finance_entries_property_date
    on finance_entries(property_id, entry_date desc);

create index if not exists idx_finance_entries_bank_status
    on finance_entries(property_id, bank_status);

alter table finance_entries enable row level security;

grant select, insert, update on table public.finance_entries to authenticated;
revoke all on table public.finance_entries from anon;

create policy "finance users can read permitted entries"
on finance_entries for select to authenticated
using (
    exists (
        select 1 from staff_users staff
        where staff.auth_user_id = auth.uid()
          and staff.is_active = true
          and staff.role in ('owner','manager')
          and (staff.role = 'owner' or staff.property_id = finance_entries.property_id)
    )
);

create policy "finance users can create permitted entries"
on finance_entries for insert to authenticated
with check (
    created_by = auth.uid()
    and exists (
        select 1 from staff_users staff
        where staff.auth_user_id = auth.uid()
          and staff.is_active = true
          and staff.role in ('owner','manager')
          and (staff.role = 'owner' or staff.property_id = finance_entries.property_id)
    )
);

create policy "finance users can update permitted entries"
on finance_entries for update to authenticated
using (
    exists (
        select 1 from staff_users staff
        where staff.auth_user_id = auth.uid()
          and staff.is_active = true
          and staff.role in ('owner','manager')
          and (staff.role = 'owner' or staff.property_id = finance_entries.property_id)
    )
)
with check (
    exists (
        select 1 from staff_users staff
        where staff.auth_user_id = auth.uid()
          and staff.is_active = true
          and staff.role in ('owner','manager')
          and (staff.role = 'owner' or staff.property_id = finance_entries.property_id)
    )
);
