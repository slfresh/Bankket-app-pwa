-- Per-seat kitchen notices (allergies, guest-wide wishes) separate from per-order special_wishes.

create table public.seat_guest_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  table_id uuid not null references public.banquet_tables (id) on delete cascade,
  seat_number int not null check (seat_number >= 1 and seat_number <= 50),
  kitchen_notice text,
  updated_at timestamptz not null default now(),
  unique (table_id, seat_number)
);

create index idx_seat_guest_notes_event on public.seat_guest_notes (event_id);
create index idx_seat_guest_notes_table on public.seat_guest_notes (table_id);

create or replace function public.set_seat_guest_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_seat_guest_notes_updated_at
  before update on public.seat_guest_notes
  for each row execute function public.set_seat_guest_notes_updated_at();

alter publication supabase_realtime add table public.seat_guest_notes;

alter table public.seat_guest_notes enable row level security;

create policy seat_guest_notes_select_staff
  on public.seat_guest_notes for select to authenticated
  using (public.current_role() in ('manager', 'waiter', 'kitchen'));

create policy seat_guest_notes_insert_waiter_manager
  on public.seat_guest_notes for insert to authenticated
  with check (
    public.current_role() in ('manager', 'waiter')
    and event_id = (select bt.event_id from public.banquet_tables bt where bt.id = table_id)
  );

create policy seat_guest_notes_update_waiter_manager
  on public.seat_guest_notes for update to authenticated
  using (public.current_role() in ('manager', 'waiter'))
  with check (
    public.current_role() in ('manager', 'waiter')
    and event_id = (select bt.event_id from public.banquet_tables bt where bt.id = table_id)
  );

create policy seat_guest_notes_delete_waiter_manager
  on public.seat_guest_notes for delete to authenticated
  using (public.current_role() in ('manager', 'waiter'));
