-- Banquet ordering: enums, tables, RLS, Realtime, kitchen RPC (no broad kitchen UPDATE on orders)
-- After first user signs up: update public.profiles set role = 'manager' where id = '<auth.users.id>';

create type public.user_role as enum ('manager', 'waiter', 'kitchen');

create type public.order_status as enum ('pending', 'cooked', 'served');

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'waiter',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'waiter')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date timestamptz not null,
  room_location text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.enforce_menu_items_count()
returns trigger
language plpgsql
as $$
declare
  cnt int;
begin
  select count(*) into cnt from public.menu_items where event_id = new.event_id;
  if tg_op = 'INSERT' and cnt >= 3 then
    raise exception 'Maximum 3 menu items per event';
  end if;
  return new;
end;
$$;

create trigger trg_menu_items_count
  before insert on public.menu_items
  for each row execute function public.enforce_menu_items_count();

create table public.banquet_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  total_seats int not null check (total_seats > 0 and total_seats <= 50),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  table_id uuid not null references public.banquet_tables (id) on delete cascade,
  seat_number int not null check (seat_number >= 1),
  menu_item_id uuid not null references public.menu_items (id) on delete restrict,
  special_wishes text,
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index orders_one_open_per_seat
  on public.orders (table_id, seat_number)
  where status in ('pending', 'cooked');

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_orders_updated_at();

create index idx_menu_items_event on public.menu_items (event_id, sort_order);
create index idx_banquet_tables_event on public.banquet_tables (event_id, sort_order);
create index idx_orders_event_status on public.orders (event_id, status);
create index idx_orders_table on public.orders (table_id);

-- Realtime (idempotent if already added)
alter publication supabase_realtime add table public.orders;

-- RLS helper
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_role() to authenticated;

-- Kitchen advances status only via RPC (SECURITY DEFINER); no broad UPDATE policy for kitchen
create or replace function public.advance_order_status(order_id uuid, next_status public.order_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.order_status;
  caller_role public.user_role;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'kitchen'::public.user_role then
    raise exception 'Forbidden';
  end if;

  select status into cur from public.orders where id = order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if cur = 'pending' and next_status = 'cooked' then
    update public.orders set status = 'cooked' where id = order_id;
  elsif cur = 'cooked' and next_status = 'served' then
    update public.orders set status = 'served' where id = order_id;
  else
    raise exception 'Invalid transition';
  end if;
end;
$$;

grant execute on function public.advance_order_status(uuid, public.order_status) to authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.menu_items enable row level security;
alter table public.banquet_tables enable row level security;
alter table public.orders enable row level security;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_select_manager
  on public.profiles for select to authenticated
  using (public.current_role() = 'manager');

create policy events_select_staff
  on public.events for select to authenticated
  using (public.current_role() in ('manager', 'waiter', 'kitchen'));

create policy events_insert_manager
  on public.events for insert to authenticated
  with check (public.current_role() = 'manager');

create policy events_update_manager
  on public.events for update to authenticated
  using (public.current_role() = 'manager');

create policy events_delete_manager
  on public.events for delete to authenticated
  using (public.current_role() = 'manager');

create policy menu_items_select_staff
  on public.menu_items for select to authenticated
  using (public.current_role() in ('manager', 'waiter', 'kitchen'));

create policy menu_items_write_manager
  on public.menu_items for all to authenticated
  using (public.current_role() = 'manager')
  with check (public.current_role() = 'manager');

create policy banquet_tables_select_staff
  on public.banquet_tables for select to authenticated
  using (public.current_role() in ('manager', 'waiter', 'kitchen'));

create policy banquet_tables_write_manager
  on public.banquet_tables for all to authenticated
  using (public.current_role() = 'manager')
  with check (public.current_role() = 'manager');

create policy orders_select_staff
  on public.orders for select to authenticated
  using (public.current_role() in ('manager', 'waiter', 'kitchen'));

create policy orders_insert_waiter_manager
  on public.orders for insert to authenticated
  with check (
    public.current_role() in ('manager', 'waiter')
    and event_id in (select id from public.events)
    and table_id in (select id from public.banquet_tables where event_id = orders.event_id)
    and menu_item_id in (select id from public.menu_items where event_id = orders.event_id)
  );

create policy orders_update_waiter_manager_pending
  on public.orders for update to authenticated
  using (
    public.current_role() in ('manager', 'waiter')
    and status = 'pending'
  )
  with check (
    public.current_role() in ('manager', 'waiter')
    and status = 'pending'
  );

create policy orders_update_manager
  on public.orders for update to authenticated
  using (public.current_role() = 'manager')
  with check (public.current_role() = 'manager');

create policy orders_delete_manager
  on public.orders for delete to authenticated
  using (public.current_role() = 'manager');

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
