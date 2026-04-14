-- Kitchen board: managers may advance order status (same as kitchen staff).
-- Waiters may delete their own pending mistakes (defense in depth with server action).

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
  if caller_role is distinct from 'kitchen'::public.user_role
     and caller_role is distinct from 'manager'::public.user_role then
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

drop policy if exists orders_delete_waiter_pending on public.orders;

create policy orders_delete_waiter_pending
  on public.orders for delete to authenticated
  using (
    public.current_role() = 'waiter'
    and status = 'pending'
  );
