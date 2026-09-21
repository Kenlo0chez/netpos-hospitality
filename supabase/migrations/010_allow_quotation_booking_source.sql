-- Reservations created from accepted quotations retain their true source.
alter table public.reservations
  drop constraint if exists reservations_booking_source_check;

alter table public.reservations
  add constraint reservations_booking_source_check
  check (booking_source in (
    'walk_in',
    'phone',
    'whatsapp',
    'email',
    'website',
    'agent',
    'corporate',
    'quotation',
    'other'
  ));
