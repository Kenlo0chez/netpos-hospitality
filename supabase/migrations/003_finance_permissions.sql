-- Allow signed-in Netpos staff to reach the finance table.
-- Row-level security policies in 002_finance.sql still decide which rows
-- each owner or manager may read and change.

grant select, insert, update on table public.finance_entries to authenticated;
revoke all on table public.finance_entries from anon;
