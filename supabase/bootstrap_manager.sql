-- Run once in Supabase SQL Editor after your first user exists (Dashboard → Authentication → Users).
-- Replace the UUID below with that user’s id from auth.users (same as profiles.id).

update public.profiles
set role = 'manager'
where id = '00000000-0000-0000-0000-000000000000';

-- Verify:
-- select id, full_name, role from public.profiles;
