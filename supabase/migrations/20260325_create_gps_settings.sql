create table if not exists public.gps_settings (
  id text primary key default 'default',
  api_url text not null,
  email text not null,
  password text not null,
  updated_at timestamptz not null default now()
);

alter table public.gps_settings enable row level security;

drop policy if exists gps_settings_select on public.gps_settings;
create policy gps_settings_select
on public.gps_settings
for select
using (auth.role() = 'authenticated');

drop policy if exists gps_settings_insert on public.gps_settings;
create policy gps_settings_insert
on public.gps_settings
for insert
with check (auth.role() = 'authenticated');

drop policy if exists gps_settings_update on public.gps_settings;
create policy gps_settings_update
on public.gps_settings
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
