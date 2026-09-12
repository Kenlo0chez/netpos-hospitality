-- NETPOS HOSPITALITY: controlled finance foundation
-- Additive only. Existing reservations, invoices and payments remain unchanged.

create table bank_accounts (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),
    account_name text not null,
    bank_name text not null,
    account_number_masked text,
    branch_code text,
    currency_code text not null default 'NAD',
    opening_balance numeric(14,2) not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(property_id, account_name)
);

create table expense_categories (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),
    name text not null,
    account_code text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    unique(property_id, name)
);

insert into expense_categories (property_id, name, account_code)
select property.id, category.name, category.account_code
from properties property
cross join (values
    ('Cleaning Supplies', 'EXP-CLEAN'),
    ('Electricity and Water', 'EXP-UTIL'),
    ('Food and Beverages', 'EXP-FNB'),
    ('Laundry', 'EXP-LAUNDRY'),
    ('Maintenance and Repairs', 'EXP-MAINT'),
    ('Office and Administration', 'EXP-ADMIN'),
    ('Staff Costs', 'EXP-STAFF'),
    ('Transport', 'EXP-TRANS'),
    ('Other Expenses', 'EXP-OTHER')
) as category(name, account_code)
on conflict (property_id, name) do nothing;

create table expenses (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),
    trading_day_id uuid references trading_days(id),
    category_id uuid references expense_categories(id),
    bank_account_id uuid references bank_accounts(id),
    expense_date date not null default current_date,
    supplier_name text not null,
    reference text,
    description text not null,
    payment_method text not null check (payment_method in ('cash','card','eft','account')),
    subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
    vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
    total_amount numeric(14,2) not null check (total_amount >= 0),
    status text not null default 'posted' check (status in ('draft','posted','reversed')),
    reversal_reason text,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table payment_allocations (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),
    payment_id uuid not null references payments(id),
    invoice_id uuid not null references invoices(id),
    amount numeric(14,2) not null check (amount > 0),
    allocated_by uuid,
    allocated_at timestamptz not null default now(),
    unique(payment_id, invoice_id)
);

create table bank_statement_imports (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),
    bank_account_id uuid not null references bank_accounts(id),
    file_name text not null,
    statement_from date,
    statement_to date,
    row_count integer not null default 0 check (row_count >= 0),
    imported_by uuid,
    imported_at timestamptz not null default now()
);

create table bank_statement_lines (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),
    bank_account_id uuid not null references bank_accounts(id),
    import_id uuid not null references bank_statement_imports(id) on delete cascade,
    transaction_date date not null,
    description text not null,
    bank_reference text,
    amount numeric(14,2) not null,
    balance numeric(14,2),
    match_status text not null default 'unmatched' check (match_status in ('unmatched','suggested','matched','ignored')),
    matched_payment_id uuid references payments(id),
    matched_expense_id uuid references expenses(id),
    matched_at timestamptz,
    matched_by uuid,
    fingerprint text not null,
    created_at timestamptz not null default now(),
    unique(bank_account_id, fingerprint)
);

create table bank_reconciliations (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),
    bank_account_id uuid not null references bank_accounts(id),
    period_start date not null,
    period_end date not null,
    statement_closing_balance numeric(14,2) not null,
    system_closing_balance numeric(14,2) not null,
    difference numeric(14,2) not null,
    status text not null default 'draft' check (status in ('draft','completed','reopened')),
    completed_at timestamptz,
    completed_by uuid,
    notes text,
    created_at timestamptz not null default now(),
    check (period_end >= period_start),
    unique(bank_account_id, period_start, period_end)
);

alter table payments add column bank_account_id uuid references bank_accounts(id);
alter table payments add column cleared_status text not null default 'unreconciled'
    check (cleared_status in ('unreconciled','matched','reconciled'));
alter table payments add column cleared_at timestamptz;

create index idx_bank_accounts_property on bank_accounts(property_id);
create index idx_expenses_property_date on expenses(property_id, expense_date);
create index idx_payment_allocations_invoice on payment_allocations(invoice_id);
create index idx_statement_lines_match on bank_statement_lines(bank_account_id, match_status, transaction_date);
create index idx_reconciliations_period on bank_reconciliations(bank_account_id, period_end);

-- Finance data must never be exposed to unauthenticated API requests.
alter table bank_accounts enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;
alter table payment_allocations enable row level security;
alter table bank_statement_imports enable row level security;
alter table bank_statement_lines enable row level security;
alter table bank_reconciliations enable row level security;

create policy "Authenticated staff manage bank accounts" on bank_accounts
    for all to authenticated using (true) with check (true);
create policy "Authenticated staff manage expense categories" on expense_categories
    for all to authenticated using (true) with check (true);
create policy "Authenticated staff manage expenses" on expenses
    for all to authenticated using (true) with check (true);
create policy "Authenticated staff manage payment allocations" on payment_allocations
    for all to authenticated using (true) with check (true);
create policy "Authenticated staff manage statement imports" on bank_statement_imports
    for all to authenticated using (true) with check (true);
create policy "Authenticated staff manage statement lines" on bank_statement_lines
    for all to authenticated using (true) with check (true);
create policy "Authenticated staff manage reconciliations" on bank_reconciliations
    for all to authenticated using (true) with check (true);
