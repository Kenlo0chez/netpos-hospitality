-- NETPOS HOSPITALITY: controlled payouts
-- Payouts are non-expense disbursements. Purchases remain in expenses and guest refunds in payments.

create table payouts (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),
    trading_day_id uuid references trading_days(id),
    bank_account_id uuid references bank_accounts(id),
    payout_date date not null default current_date,
    payee_name text not null,
    payout_type text not null check (payout_type in (
        'petty_cash',
        'owner_drawing',
        'staff_advance',
        'cash_transfer',
        'bank_charge',
        'other'
    )),
    payment_method text not null check (payment_method in ('cash','eft','card')),
    reference text not null,
    reason text not null,
    amount numeric(14,2) not null check (amount > 0),
    status text not null default 'posted' check (status in ('posted','reversed')),
    reversal_reason text,
    reversed_at timestamptz,
    created_by uuid,
    approved_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_payouts_property_date on payouts(property_id, payout_date);
create index idx_payouts_trading_day on payouts(trading_day_id);
create index idx_payouts_bank_account on payouts(bank_account_id);

alter table bank_statement_lines
    add column matched_payout_id uuid references payouts(id);

alter table payouts enable row level security;

create policy "Authenticated staff manage payouts" on payouts
    for all to authenticated using (true) with check (true);

