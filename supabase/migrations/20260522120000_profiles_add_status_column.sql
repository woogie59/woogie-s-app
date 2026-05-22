-- Member soft-delete: active | inactive (historical data preserved)
alter table public.profiles
add column if not exists status text not null default 'active';

update public.profiles
set status = 'active'
where status is null;

alter table public.profiles
drop constraint if exists profiles_status_check;

alter table public.profiles
add constraint profiles_status_check check (status in ('active', 'inactive'));
