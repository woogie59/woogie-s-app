-- booking_admin_notify_live.sql — 관리자 예약/취소 푸시 outbox (추가 전용, 1 트랜잭션)
-- 승인 범위: 서버 발송 + 알림 기록/재시도 추가 (phonemsg-01M6NTWZ1VWCB4AQASJ0VYV3D0).
-- 기존 테이블 변경 없음, 백필 없음, 삭제 없음, 캘린더 이동 없음.
BEGIN;

-- 1) 대기 기록 테이블. payload는 기존 푸시 본문에 이미 포함되는 최소 스냅샷(이름/날짜/시각)만.
--    bookings 행은 취소 시 hard delete되므로 스냅샷이 필수.
CREATE TABLE IF NOT EXISTS public.booking_notify_jobs (
  booking_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('created','cancelled')),
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','provider_accepted','skipped','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  message_id uuid,
  claim_token uuid,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  PRIMARY KEY (booking_id, kind)
);
ALTER TABLE public.booking_notify_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_notify_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.booking_notify_jobs TO service_role;

-- 2) Vault 공유 시크릿 + service_role 전용 조회 RPC
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'booking_notify_secret') THEN
    PERFORM vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'booking_notify_secret', 'Booking admin notification server secret');
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.internal_booking_notify_secret() RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'booking_notify_secret' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.internal_booking_notify_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_booking_notify_secret() TO service_role;

-- 3) 즉시 발송 시도 (best-effort; 실패해도 예약/취소 자체는 성공해야 함 — outbox가 보존)
CREATE OR REPLACE FUNCTION public.booking_notify_fire(p_booking_id uuid, p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text;
BEGIN
  SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'booking_notify_secret' LIMIT 1;
  IF s IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://qleaffojoqeqlyrwxpeb.supabase.co/functions/v1/booking-admin-notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-booking-notify-secret', s),
    body := jsonb_build_object('booking_id', p_booking_id, 'kind', p_kind)
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
REVOKE ALL ON FUNCTION public.booking_notify_fire(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_notify_fire(uuid, text) TO service_role;

-- 4) enqueue 트리거: INSERT → 'created', DELETE(회원 취소) → 'cancelled'. UPDATE는 알림 없음(현행 유지).
CREATE OR REPLACE FUNCTION public.notify_booking_admin_enqueue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_kind text; v_name text; v_date text; v_time text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_id := NEW.id; v_kind := 'created'; v_date := NEW.date::text; v_time := NEW.time::text;
    SELECT name INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_id := OLD.id; v_kind := 'cancelled'; v_date := OLD.date::text; v_time := OLD.time::text;
    SELECT name INTO v_name FROM public.profiles WHERE id = OLD.user_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;
  INSERT INTO public.booking_notify_jobs (booking_id, kind, payload)
  VALUES (v_id, v_kind, jsonb_build_object('name', coalesce(nullif(trim(v_name), ''), '회원'), 'date', v_date, 'time', v_time))
  ON CONFLICT (booking_id, kind) DO NOTHING;
  PERFORM public.booking_notify_fire(v_id, v_kind);
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.notify_booking_admin_enqueue() FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'booking_admin_notify_enqueue' AND tgrelid = 'public.bookings'::regclass) THEN
    CREATE TRIGGER booking_admin_notify_enqueue AFTER INSERT OR DELETE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.notify_booking_admin_enqueue();
  END IF;
END $$;

-- 5) 스위퍼: stale sending 회수, 24h 만기, pending 재시도(≤5회). 자동 삭제 없음.
CREATE OR REPLACE FUNCTION public.booking_notify_sweep() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  UPDATE public.booking_notify_jobs SET state = 'failed', last_error = 'retry_window_expired', claim_token = NULL, locked_at = NULL
  WHERE state IN ('pending','sending') AND created_at <= now() - interval '1 day';
  UPDATE public.booking_notify_jobs SET state = 'pending', claim_token = NULL, locked_at = NULL
  WHERE state = 'sending' AND locked_at < now() - interval '5 minutes';
  FOR r IN SELECT booking_id, kind FROM public.booking_notify_jobs
           WHERE state = 'pending' AND attempts < 5 AND created_at > now() - interval '1 day'
           ORDER BY created_at LIMIT 20 LOOP
    PERFORM public.booking_notify_fire(r.booking_id, r.kind);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.booking_notify_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_notify_sweep() TO service_role;
SELECT cron.schedule('booking-admin-notify-sweep', '*/5 * * * *', 'SELECT public.booking_notify_sweep()')
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'booking-admin-notify-sweep');

COMMIT;
