-- Apply ONLY after live metadata and Edge deployment verification. New objects only.
-- Reuses the existing server secret; no new credential generated.
BEGIN;
CREATE FUNCTION public.slot_alert_wake() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s text;
BEGIN
 SELECT public.internal_booking_notify_secret() INTO s;
 IF s IS NULL THEN RETURN; END IF;
 PERFORM net.http_post(url:='https://qleaffojoqeqlyrwxpeb.supabase.co/functions/v1/slot-available-notify',
  headers:=jsonb_build_object('Content-Type','application/json','x-booking-notify-secret',s),body:='{}'::jsonb);
EXCEPTION WHEN OTHERS THEN NULL; -- Durable outbox is retained for retry.
END;
$$;
CREATE FUNCTION public.slot_alert_dispatch_tick() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.slot_alert_maintain();
 IF EXISTS(SELECT 1 FROM public.slot_alert_jobs WHERE state='pending') THEN PERFORM public.slot_alert_wake(); END IF;
END;
$$;
-- A statement-level trigger wakes once for each new job insertion statement, not for every retry.
CREATE FUNCTION public.slot_alert_wake_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.slot_alert_wake(); RETURN NULL;
END;
$$;
CREATE TRIGGER slot_alert_wake_trigger AFTER INSERT ON public.slot_alert_jobs FOR EACH STATEMENT EXECUTE FUNCTION public.slot_alert_wake_trigger();
REVOKE ALL ON FUNCTION public.slot_alert_wake(), public.slot_alert_dispatch_tick(),public.slot_alert_wake_trigger() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.slot_alert_dispatch_tick() TO service_role;
SELECT cron.schedule('slot-alert-dispatch','*/5 * * * *','SELECT public.slot_alert_dispatch_tick()')
WHERE NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='slot-alert-dispatch');
COMMIT;
