-- Block inserts into orders when the event is inactive (defense in depth with placeOrder server action).

drop policy if exists orders_insert_waiter_manager on public.orders;

create policy orders_insert_waiter_manager
  on public.orders for insert to authenticated
  with check (
    public.current_role() in ('manager', 'waiter')
    and event_id in (select id from public.events where is_active = true)
    and table_id in (select id from public.banquet_tables where event_id = orders.event_id)
    and menu_item_id in (select id from public.menu_items where event_id = orders.event_id)
  );
