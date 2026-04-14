-- Multi-course: menu items and orders carry a course (starter / main / dessert).
-- Up to 3 menu labels per course per event. One open order per seat per course.

create type public.menu_course as enum ('starter', 'main', 'dessert');

alter table public.menu_items
  add column course public.menu_course not null default 'main';

alter table public.orders
  add column course public.menu_course not null default 'main';

drop index if exists public.orders_one_open_per_seat;

create unique index orders_one_open_per_seat_course
  on public.orders (table_id, seat_number, course)
  where (status in ('pending', 'cooked'));

create index idx_menu_items_event_course on public.menu_items (event_id, course, sort_order);
create index idx_orders_table_course on public.orders (table_id, course);

-- Replace trigger: max 3 items per (event_id, course)
create or replace function public.enforce_menu_items_count()
returns trigger
language plpgsql
as $$
declare
  cnt int;
begin
  select count(*) into cnt
  from public.menu_items
  where event_id = new.event_id and course = new.course;
  if tg_op = 'INSERT' and cnt >= 3 then
    raise exception 'Maximum 3 menu items per course for this event';
  end if;
  return new;
end;
$$;

-- Audit log: include course in metadata
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
      jsonb_build_object('menu_item_id', new.menu_item_id, 'course', new.course::text)
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
      jsonb_build_object('menu_item_id', old.menu_item_id, 'course', old.course::text)
    );
    return old;
  end if;
  return null;
end;
$$;

comment on column public.menu_items.course is 'Banquet course: starter, main, or dessert.';
comment on column public.orders.course is 'Must match the menu_item.course for this order.';
