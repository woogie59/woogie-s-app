-- 페이롤 매출 등록 월 (해당 월 급여/매출 시트에 반영)
alter table public.session_batches
  add column if not exists sales_applied_month date;

comment on column public.session_batches.sales_applied_month is
  'Payroll sales recognition month (1st of month). Distinct from created_at registration date.';
