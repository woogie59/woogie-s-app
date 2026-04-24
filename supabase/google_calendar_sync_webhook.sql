-- =============================================================================
-- Real-time `bookings` → Edge Function `google-calendar-sync` (pg_net)
-- Run in Supabase SQL Editor after:
--   1) `supabase db push` (or run migration that adds `google_event_id` + this file's extension)
--   2) `supabase functions deploy google-calendar-sync`
--   3) Secrets: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CALENDAR_ID
--
-- Replace the three placeholders at the top before executing.
-- =============================================================================

-- Project REST URL (e.g. https://abcdefghijk.supabase.co)
-- Service role key: Dashboard → Project Settings → API → service_role (keep secret!)

-- ---------------------------------------------------------------------------
-- 1) Optional: ensure pg_net (Supabase usually has it; enable if not)
-- ---------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
-- (If you get "permission denied", use Dashboard → Database → Extensions: enable `pg_net`.)

-- ---------------------------------------------------------------------------
-- 2) Set secrets for the trigger (avoids hardcoding the service key in a plain trigger)
-- Recommended: set once per session / use Vault in production.
-- For a simple one-off, you can replace ::text with your literal in the trigger body
-- and skip this DO block.
-- ---------------------------------------------------------------------------
-- Example using current_setting (set from a privileged migration only if you accept the risk):
--   ALTER DATABASE postgres SET app.google_sync_url = 'https://YOUR_REF.supabase.co';
--   ALTER DATABASE postgres SET app.google_sync_bearer = 'YOUR_SERVICE_ROLE_JWT';
-- then use current_setting() in the trigger — many teams prefer **Database Webhooks** in the
-- Supabase Dashboard instead to avoid storing the key in the DB.

CREATE OR REPLACE FUNCTION public.notify_bookings_google_calendar_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload   jsonb;
  base_url  text := 'https://YOUR_PROJECT_REF.supabase.co';
  service_jwt text := 'YOUR_SERVICE_ROLE_KEY';
  req_id     bigint;
BEGIN
  -- Same shape as Supabase Database Webhooks: https://supabase.com/docs/guides/database/webhooks
  IF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'type', 'DELETE',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', NULL,
      'old_record', to_jsonb(OLD)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    );
  ELSE
    payload := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', NULL
    );
  END IF;

  SELECT net.http_post(
    url     := base_url || '/functions/v1/google-calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_jwt
    ),
    body    := payload
  ) INTO req_id;

  RETURN COALESCE(NEW, OLD);
END
$fn$;

DROP TRIGGER IF EXISTS bookings_google_calendar_sync ON public.bookings;
CREATE TRIGGER bookings_google_calendar_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_bookings_google_calendar_sync();

-- NOTE: In production, prefer **Database → Webhooks** in the Supabase Dashboard:
--   Table: bookings, Events: all, Type: Supabase Edge Functions,
--   Function: google-calendar-sync, Add header: Authorization: Bearer <service_role>
-- That avoids maintaining the service key inside PostgreSQL and uses managed delivery/retries.
