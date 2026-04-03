-- =============================================================================
-- send-session-reminder — pg_cron: every minute (KST-aligned matching in Edge Fn)
-- =============================================================================
-- Prerequisites: extensions `pg_cron` and `pg_net`.
--
-- Replace:
--   YOUR_PROJECT_REF
--   YOUR_SERVICE_ROLE_KEY
--
-- Unschedule: SELECT cron.unschedule('send-session-reminder');
-- =============================================================================

SELECT cron.schedule(
  'send-session-reminder',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-session-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'apikey', 'YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
