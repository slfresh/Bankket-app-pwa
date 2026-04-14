-- L-shaped table layout + per-event floor plan coordinates (0–1 canvas).

alter type public.table_layout add value if not exists 'l_shape';

alter table public.banquet_tables
  add column if not exists floor_x real,
  add column if not exists floor_y real,
  add column if not exists floor_rotation real not null default 0;

comment on column public.banquet_tables.floor_x is '0–1 horizontal position on the event floor canvas (null = not placed)';
comment on column public.banquet_tables.floor_y is '0–1 vertical position on the event floor canvas (null = not placed)';
comment on column public.banquet_tables.floor_rotation is 'Clockwise degrees for the table widget on the floor plan';

alter table public.banquet_tables
  add constraint banquet_tables_floor_x_range check (floor_x is null or (floor_x >= 0 and floor_x <= 1)),
  add constraint banquet_tables_floor_y_range check (floor_y is null or (floor_y >= 0 and floor_y <= 1));

-- Backfill: simple grid (4 columns) so existing events get a usable floor view
with numbered as (
  select
    id,
    (row_number() over (partition by event_id order by sort_order, id) - 1) as idx
  from public.banquet_tables
)
update public.banquet_tables t
set
  floor_x = 0.08 + (numbered.idx % 4) * 0.24,
  floor_y = 0.08 + floor(numbered.idx / 4) * 0.22
from numbered
where t.id = numbered.id
  and t.floor_x is null
  and t.floor_y is null;
