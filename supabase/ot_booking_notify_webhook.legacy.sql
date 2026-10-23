-- =============================================================================
-- ot_bookings INSERT → Edge Function `ot-booking-notify` (서버 검증형 관리자 푸시)
-- 실행 전: 1) ot migration 적용  2) `supabase functions deploy ot-booking-notify`
--          3) Secrets: OT_WEBHOOK_SECRET (아래 트리거와 동일 값), ONESIGNAL_APP_ID,
--             ONESIGNAL_REST_API_KEY
-- 권장: Dashboard → Database → Webhooks 로 만드는 방식(비밀값을 DB에 두지 않음).
--       아래 pg_net 트리거는 대안. YOUR_* 자리를 채운 뒤 SQL Editor에서 실행.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_ot_booking_admin_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload   jsonb;
  base_url  text := 'https://YOUR_PROJECT_REF.supabase.co';
  secret    text := 'YOUR_OT_WEBHOOK_SECRET';
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW)
  );
  PERFORM net.http_post(
    url := base_url || '/functions/v1/ot-booking-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ot-webhook-secret', secret
    ),
    body := payload
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS ot_booking_admin_push ON public.ot_bookings;
CREATE TRIGGER ot_booking_admin_push
  AFTER INSERT ON public.ot_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ot_booking_admin_push();

-- 캘린더는 기존 google-calendar-sync에 trainer_blocked_slots용 Database Webhook을
-- 연결하는 것으로 서버 보장이 된다 (INSERT는 google_event_id가 있으면 skip하는 멱등).
-- 이름 없는 OT block은 '오티' 제목으로 등록된다 (함수 폴백).

-- ---------------------------------------------------------------------------
-- 관리자 화면 "푸시 재시도" 버튼용 RPC: 서버가 ot-booking-notify를 다시 호출.
-- 실행 전: ALTER DATABASE postgres SET app.ot_notify_url = 'https://<ref>.supabase.co/functions/v1/ot-booking-notify';
--          ALTER DATABASE postgres SET app.ot_notify_secret = '<OT_WEBHOOK_SECRET과 동일 값>';
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ot_admin_resend_push(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;
  v_url := current_setting('app.ot_notify_url', true);
  v_secret := current_setting('app.ot_notify_secret', true);
  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RETURN json_build_object('ok', false, 'error', 'sync_not_configured');
  END IF;
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ot-webhook-secret', v_secret),
    body := jsonb_build_object('booking_id', p_booking_id)
  );
  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ot_admin_resend_push(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ot_admin_resend_push(uuid) TO authenticated;
