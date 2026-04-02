-- Total pack amount (KRW) entered in admin “Add Session Pack”; Revenue Total Sales sums this per month.
alter table public.session_batches
  add column if not exists price numeric;

comment on column public.session_batches.price is 'Total session pack amount (KRW) for revenue reporting';
