-- ============================================================
-- NETPOS HOSPITALITY
-- Initial Database Schema
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- PROPERTIES
-- Individual guest houses / hotels managed by the system
-- ============================================================

create table properties (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    code text not null unique,
    legal_name text,
    registration_number text,
    vat_number text,

    phone text,
    email text,
    whatsapp_number text,

    address_line_1 text,
    address_line_2 text,
    town text,
    region text,
    country text default 'Namibia',

    currency_code text not null default 'NAD',
    vat_rate numeric(5,2) not null default 15.00,

    quotation_prefix text default 'QUO',
    reservation_prefix text default 'RES',
    invoice_prefix text default 'INV',
    receipt_prefix text default 'RCT',

    bank_name text,
    bank_account_name text,
    bank_account_number text,
    bank_branch_code text,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================
-- ROOM TYPES
-- Standard, Double, Twin, Family, Executive, etc.
-- ============================================================

create table room_types (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),

    name text not null,
    code text not null,
    description text,

    standard_occupancy integer not null default 1,
    maximum_adults integer not null default 2,
    maximum_children integer not null default 0,
    maximum_occupancy integer not null default 2,

    base_rate numeric(12,2) not null default 0,
    extra_adult_rate numeric(12,2) not null default 0,
    extra_child_rate numeric(12,2) not null default 0,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique(property_id, code)
);

-- ============================================================
-- INDIVIDUAL ROOMS
-- ============================================================

create table rooms (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),
    room_type_id uuid not null references room_types(id),

    room_number text not null,
    room_name text,
    floor text,

    operational_status text not null default 'active'
        check (operational_status in (
            'active',
            'maintenance',
            'out_of_order',
            'inactive'
        )),

    housekeeping_status text not null default 'clean'
        check (housekeeping_status in (
            'clean',
            'dirty',
            'inspected',
            'cleaning'
        )),

    notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique(property_id, room_number)
);

-- ============================================================
-- RATE PLANS
-- Allows different pricing structures
-- ============================================================

create table rate_plans (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id),

    name text not null,
    code text not null,

    description text,

    valid_from date,
    valid_to date,

    is_default boolean not null default false,
    is_active boolean not null default true,

    created_at timestamptz not null default now(),

    unique(property_id, code)
);

create table room_rates (
    id uuid primary key default gen_random_uuid(),

    property_id uuid not null references properties(id),
    room_type_id uuid not null references room_types(id),
    rate_plan_id uuid references rate_plans(id),

    rate_date date,

    nightly_rate numeric(12,2) not null,
    extra_adult_rate numeric(12,2) not null default 0,
    extra_child_rate numeric(12,2) not null default 0,

    minimum_stay integer not null default 1,

    created_at timestamptz not null default now()
);

-- ============================================================
-- COMPANIES / CORPORATE ACCOUNTS
-- ============================================================

create table companies (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    registration_number text,
    vat_number text,

    contact_person text,
    phone text,
    email text,

    address text,

    credit_allowed boolean not null default false,
    credit_limit numeric(12,2) not null default 0,
    payment_terms_days integer not null default 0,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================
-- GUESTS
-- ============================================================

create table guests (
    id uuid primary key default gen_random_uuid(),

    first_name text not null,
    last_name text not null,

    phone text,
    whatsapp_number text,
    email text,

    id_type text,
    id_number text,

    nationality text,
    address text,

    company_id uuid references companies(id),

    notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================
-- QUOTATIONS
-- Enquiry -> Quote -> Booking
-- ============================================================

create table quotations (
    id uuid primary key default gen_random_uuid(),

    property_id uuid not null references properties(id),
    guest_id uuid references guests(id),
    company_id uuid references companies(id),

    quote_number text not null unique,

    status text not null default 'draft'
        check (status in (
            'draft',
            'sent',
            'accepted',
            'declined',
            'expired',
            'converted',
            'cancelled'
        )),

    arrival_date date not null,
    departure_date date not null,

    adults integer not null default 1,
    children integer not null default 0,

    valid_until date,

    subtotal numeric(12,2) not null default 0,
    discount_amount numeric(12,2) not null default 0,
    vat_amount numeric(12,2) not null default 0,
    total_amount numeric(12,2) not null default 0,

    notes text,
    terms text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table quotation_items (
    id uuid primary key default gen_random_uuid(),

    quotation_id uuid not null references quotations(id) on delete cascade,

    room_type_id uuid references room_types(id),

    description text not null,
    quantity numeric(12,2) not null default 1,
    nights integer not null default 1,

    unit_price numeric(12,2) not null default 0,
    discount_amount numeric(12,2) not null default 0,
    vat_amount numeric(12,2) not null default 0,
    line_total numeric(12,2) not null default 0,

    created_at timestamptz not null default now()
);

-- ============================================================
-- RESERVATIONS
-- ============================================================

create table reservations (
    id uuid primary key default gen_random_uuid(),

    property_id uuid not null references properties(id),
    guest_id uuid not null references guests(id),
    company_id uuid references companies(id),
    quotation_id uuid references quotations(id),

    reservation_number text not null unique,

    status text not null default 'confirmed'
        check (status in (
            'provisional',
            'confirmed',
            'checked_in',
            'checked_out',
            'cancelled',
            'no_show'
        )),

    booking_source text default 'walk_in'
        check (booking_source in (
            'walk_in',
            'phone',
            'whatsapp',
            'email',
            'website',
            'agent',
            'corporate',
            'other'
        )),

    arrival_date date not null,
    departure_date date not null,

    adults integer not null default 1,
    children integer not null default 0,

    subtotal numeric(12,2) not null default 0,
    discount_amount numeric(12,2) not null default 0,
    vat_amount numeric(12,2) not null default 0,
    total_amount numeric(12,2) not null default 0,

    deposit_required numeric(12,2) not null default 0,

    notes text,

    checked_in_at timestamptz,
    checked_out_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    check (departure_date > arrival_date)
);

-- ============================================================
-- ROOMS ATTACHED TO A RESERVATION
-- Supports multi-room bookings
-- ============================================================

create table reservation_rooms (
    id uuid primary key default gen_random_uuid(),

    reservation_id uuid not null
        references reservations(id) on delete cascade,

    room_type_id uuid not null references room_types(id),
    room_id uuid references rooms(id),
    rate_plan_id uuid references rate_plans(id),

    adults integer not null default 1,
    children integer not null default 0,

    nightly_rate numeric(12,2) not null default 0,

    original_rate numeric(12,2),
    rate_override_reason text,

    discount_amount numeric(12,2) not null default 0,

    arrival_date date not null,
    departure_date date not null,

    created_at timestamptz not null default now(),

    check (departure_date > arrival_date)
);

-- ============================================================
-- TRADING / PAYMENT DAYS
-- Foundation for End-of-Day / Cash-Up
-- ============================================================

create table trading_days (
    id uuid primary key default gen_random_uuid(),

    property_id uuid not null references properties(id),

    business_date date not null,

    status text not null default 'open'
        check (status in ('open','closed')),

    opened_at timestamptz not null default now(),
    closed_at timestamptz,

    opening_float numeric(12,2) not null default 0,

    expected_cash numeric(12,2),
    counted_cash numeric(12,2),
    cash_variance numeric(12,2),

    closing_notes text,

    created_at timestamptz not null default now(),

    unique(property_id, business_date)
);

-- ============================================================
-- PAYMENTS
-- Cash / Card / EFT / Account handled separately
-- ============================================================

create table payments (
    id uuid primary key default gen_random_uuid(),

    property_id uuid not null references properties(id),
    trading_day_id uuid not null references trading_days(id),

    reservation_id uuid references reservations(id),
    guest_id uuid references guests(id),
    company_id uuid references companies(id),

    payment_reference text,

    payment_method text not null
        check (payment_method in (
            'cash',
            'card',
            'eft',
            'account'
        )),

    transaction_type text not null default 'payment'
        check (transaction_type in (
            'payment',
            'deposit',
            'refund'
        )),

    amount numeric(12,2) not null,

    notes text,

    received_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- ============================================================
-- INVOICES
-- ============================================================

create table invoices (
    id uuid primary key default gen_random_uuid(),

    property_id uuid not null references properties(id),
    reservation_id uuid references reservations(id),
    guest_id uuid references guests(id),
    company_id uuid references companies(id),

    invoice_number text not null unique,

    status text not null default 'draft'
        check (status in (
            'draft',
            'issued',
            'part_paid',
            'paid',
            'void'
        )),

    invoice_date date not null default current_date,
    due_date date,

    subtotal numeric(12,2) not null default 0,
    discount_amount numeric(12,2) not null default 0,
    vat_amount numeric(12,2) not null default 0,
    total_amount numeric(12,2) not null default 0,

    notes text,

    created_at timestamptz not null default now()
);

create table invoice_items (
    id uuid primary key default gen_random_uuid(),

    invoice_id uuid not null
        references invoices(id) on delete cascade,

    description text not null,

    quantity numeric(12,2) not null default 1,
    unit_price numeric(12,2) not null default 0,

    discount_amount numeric(12,2) not null default 0,
    vat_amount numeric(12,2) not null default 0,
    line_total numeric(12,2) not null default 0,

    created_at timestamptz not null default now()
);

-- ============================================================
-- RECEIPTS
-- ============================================================

create table receipts (
    id uuid primary key default gen_random_uuid(),

    property_id uuid not null references properties(id),
    payment_id uuid not null references payments(id),

    receipt_number text not null unique,

    issued_at timestamptz not null default now()
);

-- ============================================================
-- HOUSEKEEPING
-- ============================================================

create table housekeeping_tasks (
    id uuid primary key default gen_random_uuid(),

    property_id uuid not null references properties(id),
    room_id uuid not null references rooms(id),

    task_date date not null default current_date,

    status text not null default 'pending'
        check (status in (
            'pending',
            'in_progress',
            'completed',
            'inspected'
        )),

    assigned_to text,
    notes text,

    started_at timestamptz,
    completed_at timestamptz,

    created_at timestamptz not null default now()
);

-- ============================================================
-- USER PROFILES / PERMISSIONS FOUNDATION
-- Links to Supabase Auth
-- ============================================================

create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,

    full_name text,
    role text not null default 'receptionist'
        check (role in (
            'administrator',
            'manager',
            'receptionist',
            'cashier',
            'housekeeping',
            'report_viewer'
        )),

    default_property_id uuid references properties(id),

    is_active boolean not null default true,

    created_at timestamptz not null default now()
);

create table user_properties (
    user_id uuid not null references profiles(id) on delete cascade,
    property_id uuid not null references properties(id) on delete cascade,

    primary key(user_id, property_id)
);

-- ============================================================
-- WHATSAPP COMMUNICATION LOG
-- ============================================================

create table whatsapp_messages (
    id uuid primary key default gen_random_uuid(),

    property_id uuid references properties(id),
    guest_id uuid references guests(id),
    quotation_id uuid references quotations(id),
    reservation_id uuid references reservations(id),

    direction text not null
        check (direction in ('incoming','outgoing')),

    message_type text not null default 'text',

    phone_number text not null,
    message_body text,

    provider_message_id text,

    status text,

    sent_at timestamptz,
    received_at timestamptz,

    created_at timestamptz not null default now()
);

-- ============================================================
-- AUDIT TRAIL
-- Critical for rates, closed days and financial corrections
-- ============================================================

create table audit_logs (
    id uuid primary key default gen_random_uuid(),

    property_id uuid references properties(id),
    user_id uuid references profiles(id),

    action text not null,
    entity_type text not null,
    entity_id uuid,

    old_values jsonb,
    new_values jsonb,

    reason text,

    created_at timestamptz not null default now()
);

-- ============================================================
-- BASIC INDEXES
-- ============================================================

create index idx_rooms_property
    on rooms(property_id);

create index idx_reservations_property_dates
    on reservations(property_id, arrival_date, departure_date);

create index idx_reservations_guest
    on reservations(guest_id);

create index idx_payments_trading_day
    on payments(trading_day_id);

create index idx_payments_property_received
    on payments(property_id, received_at);

create index idx_trading_days_property
    on trading_days(property_id, business_date);

create index idx_whatsapp_guest
    on whatsapp_messages(guest_id);

create index idx_audit_entity
    on audit_logs(entity_type, entity_id);