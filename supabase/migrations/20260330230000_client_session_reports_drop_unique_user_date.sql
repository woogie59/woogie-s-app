-- Allow multiple training logs per member per calendar day (insert-only flow).
ALTER TABLE public.client_session_reports
  DROP CONSTRAINT IF EXISTS unique_user_date;

ALTER TABLE public.client_session_reports
  DROP CONSTRAINT IF EXISTS client_session_reports_user_id_report_date_key;
