-- Future INSERT only. Existing bookings are never backfilled or resent.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ot_booking_notify_jobs (
 booking_id uuid PRIMARY KEY REFERENCES public.ot_bookings(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','provider_accepted','skipped','failed')),
 attempts int NOT NULL DEFAULT 0,
 last_error text, message_id uuid, claim_token uuid, locked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz
);
ALTER TABLE public.ot_booking_notify_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ot_booking_notify_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ot_booking_notify_jobs TO service_role;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='ot_notify_secret') THEN
  PERFORM vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'ot_notify_secret','OT notification server secret');
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.internal_ot_notify_secret() RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='ot_notify_secret' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.internal_ot_notify_secret() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.internal_ot_notify_secret() TO service_role;
CREATE OR REPLACE FUNCTION public.ot_notify_fire(p_booking_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s text;
BEGIN
 SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name='ot_notify_secret' LIMIT 1;
 IF s IS NULL THEN RETURN; END IF;
 PERFORM net.http_post(url:='https://qleaffojoqeqlyrwxpeb.supabase.co/functions/v1/ot-booking-notify',headers:=jsonb_build_object('Content-Type','application/json','x-ot-webhook-secret',s),body:=jsonb_build_object('booking_id',p_booking_id));
EXCEPTION WHEN OTHERS THEN NULL; -- Outbox preserves pending work, booking itself must succeed.
END $$;
REVOKE ALL ON FUNCTION public.ot_notify_fire(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ot_notify_fire(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.notify_ot_booking_admin_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='confirmed' THEN
  INSERT INTO public.ot_booking_notify_jobs(booking_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  PERFORM public.ot_notify_fire(NEW.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_ot_booking_admin_push() FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='ot_booking_admin_push' AND tgrelid='public.ot_bookings'::regclass) THEN
  CREATE TRIGGER ot_booking_admin_push AFTER INSERT ON public.ot_bookings FOR EACH ROW EXECUTE FUNCTION public.notify_ot_booking_admin_push();
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.ot_notify_sweep() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 UPDATE public.ot_booking_notify_jobs SET state='failed',last_error='retry_window_expired',claim_token=NULL,locked_at=NULL WHERE state IN ('pending','sending') AND created_at<=now()-interval '1 day';
 UPDATE public.ot_booking_notify_jobs SET state='pending',claim_token=NULL,locked_at=NULL WHERE state='sending' AND locked_at<now()-interval '5 minutes';
 UPDATE public.ot_bookings b SET admin_notified_at=coalesce(j.checked_at,now()) FROM public.ot_booking_notify_jobs j WHERE j.booking_id=b.id AND j.state='provider_accepted' AND b.admin_notified_at IS NULL;
 FOR r IN SELECT booking_id FROM public.ot_booking_notify_jobs WHERE state='pending' AND attempts<5 AND created_at>now()-interval '1 day' ORDER BY created_at LIMIT 20 LOOP
  PERFORM public.ot_notify_fire(r.booking_id);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.ot_notify_sweep() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ot_notify_sweep() TO service_role;
SELECT cron.schedule('ot-booking-notify-sweep','*/5 * * * *','SELECT public.ot_notify_sweep()') WHERE NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='ot-booking-notify-sweep');
COMMIT;
