create table if not exists public.admin_low_credit_alerts (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null,
  remaining_sessions integer not null,
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);

create index if not exists idx_admin_low_credit_alerts_created_at
  on public.admin_low_credit_alerts (created_at desc);

create index if not exists idx_admin_low_credit_alerts_active
  on public.admin_low_credit_alerts (dismissed_at, created_at desc);

alter table public.admin_low_credit_alerts enable row level security;

drop policy if exists "admin_low_credit_alerts_select_authenticated" on public.admin_low_credit_alerts;
create policy "admin_low_credit_alerts_select_authenticated"
on public.admin_low_credit_alerts
for select
to authenticated
using (true);

drop policy if exists "admin_low_credit_alerts_insert_authenticated" on public.admin_low_credit_alerts;
create policy "admin_low_credit_alerts_insert_authenticated"
on public.admin_low_credit_alerts
for insert
to authenticated
with check (true);

drop policy if exists "admin_low_credit_alerts_update_authenticated" on public.admin_low_credit_alerts;
create policy "admin_low_credit_alerts_update_authenticated"
on public.admin_low_credit_alerts
for update
to authenticated
using (true)
with check (true);
