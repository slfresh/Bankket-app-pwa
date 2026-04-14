-- Run once in Supabase → SQL Editor (for user UID from Authentication → Users).
-- Creates public.profiles row if missing; sets role to manager for first admin.

insert into public.profiles (id, full_name, role)
values ('be9fe25c-d9ab-4c00-a05c-aafe493afa2d', '', 'manager')
on conflict (id) do update set role = excluded.role;
