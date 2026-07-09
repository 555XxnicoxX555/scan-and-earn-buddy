alter table public.point_events
add column if not exists purchase_status text not null default 'confirmed';

alter table public.point_events
drop constraint if exists point_events_purchase_status_check;

alter table public.point_events
add constraint point_events_purchase_status_check
check (purchase_status in ('confirmed', 'cancelled', 'corrected'));
