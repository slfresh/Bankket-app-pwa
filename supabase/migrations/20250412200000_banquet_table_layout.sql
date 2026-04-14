-- How seats are shown to waiters: round (ring) vs block (rectangular grid / long tables).

create type public.table_layout as enum ('round', 'block');

alter table public.banquet_tables
  add column layout public.table_layout not null default 'round';

comment on column public.banquet_tables.layout is 'round: seats in a ring; block: seats in a rectangular grid for long/banquet rows';
