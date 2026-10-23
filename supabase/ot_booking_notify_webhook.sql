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
