-- Append-only order audit log (staff actions via triggers).
-- Optional layout_config for L-shaped seat distribution.
-- Remove broad manager read access to all profiles (managers still manage events via RLS on other tables).

create table public.order_audit_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  event_id uuid not null references public.events (id) on delete cascade,
  table_id uuid,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('created', 'status_changed', 'deleted')),
  old_status public.order_status,
  new_status public.order_status,
  seat_number int,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_order_audit_log_event_created on public.order_audit_log (event_id, created_at desc);

comment on table public.order_audit_log is 'Append-only log of order lifecycle; populated by triggers, not direct client inserts.';

alter table public.banquet_tables
  add column if not exists layout_config jsonb;

comment on column public.banquet_tables.layout_config is 'Optional JSON, e.g. {"l_legs":[10,10,10]} for l_shape; leg counts must sum to total_seats.';

create or replace function public.log_order_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_audit_log (
      order_id, event_id, table_id, actor_id, action, seat_number, metadata
    )
    values (
      new.id,
      new.event_id,
      new.table_id,
      auth.uid(),
      'created',
      new.seat_number,
      jsonb_build_object('menu_item_id', new.menu_item_id)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      insert into public.order_audit_log (
        order_id, event_id, table_id, actor_id, action, old_status, new_status, seat_number
      )
      values (
        new.id,
        new.event_id,
        new.table_id,
        auth.uid(),
        'status_changed',
        old.status,
        new.status,
        new.seat_number
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.order_audit_log (
      order_id, event_id, table_id, actor_id, action, old_status, seat_number, metadata
    )
    values (
      old.id,
      old.event_id,
      old.table_id,
      auth.uid(),
      'deleted',
      old.status,
      old.seat_number,
      jsonb_build_object('menu_item_id', old.menu_item_id)
    );
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_orders_audit
  after insert or update or delete on public.orders
  for each row execute function public.log_order_audit();

alter table public.order_audit_log enable row level security;

create policy order_audit_log_select_manager
  on public.order_audit_log for select to authenticated
  using (public.current_role() = 'manager');

drop policy if exists profiles_select_manager on public.profiles;

grant select on public.order_audit_log to authenticated;
