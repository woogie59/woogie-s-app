-- =============================================================================
-- Morning Concierge — pg_cron jobs (run manually in Supabase SQL Editor)
-- =============================================================================
-- Prerequisites: enable extensions `pg_cron` and `pg_net` (Dashboard → Database → Extensions).
--
-- Replace before execution:
--   YOUR_PROJECT_REF      → from https://YOUR_PROJECT_REF.supabase.co
--   YOUR_SERVICE_ROLE_KEY → Project Settings → API → service_role (keep secret)
--
-- Schedule (UTC; Korea KST = UTC+9, no DST):
--   08:30 KST → 23:30 UTC (previous calendar day in UTC)  slot=early
--   10:00 KST → 01:00 UTC                                 slot=late
--
-- Unschedule:
--   SELECT cron.unschedule('morning-concierge-early');
--   SELECT cron.unschedule('morning-concierge-late');
-- =============================================================================

SELECT cron.schedule(
  'morning-concierge-early',
  '30 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/morning-concierge?slot=early',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'apikey', 'YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'morning-concierge-late',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/morning-concierge?slot=late',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'apikey', 'YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
