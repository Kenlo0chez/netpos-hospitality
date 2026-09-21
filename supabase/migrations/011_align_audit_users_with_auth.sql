-- Audit records store auth.uid(), so their foreign keys must reference
-- Supabase Auth directly rather than the legacy profiles table.
alter table public.audit_logs
  drop constraint if exists audit_logs_user_id_fkey;

alter table public.audit_logs
  add constraint audit_logs_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete set null;

alter table public.end_of_day_snapshots
  drop constraint if exists end_of_day_snapshots_closed_by_fkey;

alter table public.end_of_day_snapshots
  add constraint end_of_day_snapshots_closed_by_fkey
  foreign key (closed_by)
  references auth.users(id)
  on delete set null;
