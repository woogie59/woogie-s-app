-- 피티 등록 신청(ot_pt_requests) 관리자 푸시: 서버 발송 + 아웃박스 + 재시도
-- ot_booking_notify_live.sql 과 같은 구조. 2026-11-17 사용자 요청("피티등록 신청 시 알림이 안 옴").
-- 적용 전 사용자 승인 필요 (DB 추가). 적용 방법: Supabase SQL Editor에서 전체 실행.
-- Future INSERT only. 기존 신청은 소급 발송하지 않음.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ot_pt_request_notify_jobs (
 request_id uuid PRIMARY KEY REFERENCES public.ot_pt_requests(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','provider_accepted','skipped','failed')),
 attempts int NOT NULL DEFAULT 0,
 last_error text, message_id uuid, claim_token uuid, locked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz
);
ALTER TABLE public.ot_pt_request_notify_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ot_pt_request_notify_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ot_pt_request_notify_jobs TO service_role;
-- 기존 ot_notify_secret 재사용 (새 비밀 생성 없음)
CREATE OR REPLACE FUNCTION public.ot_pt_notify_fire(p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s text;
BEGIN
 SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name='ot_notify_secret' LIMIT 1;
 IF s IS NULL THEN RETURN; END IF;
 PERFORM net.http_post(url:='https://qleaffojoqeqlyrwxpeb.supabase.co/functions/v1/ot-pt-request-notify',headers:=jsonb_build_object('Content-Type','application/json','x-ot-webhook-secret',s),body:=jsonb_build_object('request_id',p_request_id));
EXCEPTION WHEN OTHERS THEN NULL; -- 아웃박스가 pending을 보존. 신청 저장 자체는 실패하면 안 됨.
END $$;
REVOKE ALL ON FUNCTION public.ot_pt_notify_fire(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ot_pt_notify_fire(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.notify_ot_pt_request_admin_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='requested' THEN
  INSERT INTO public.ot_pt_request_notify_jobs(request_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  PERFORM public.ot_pt_notify_fire(NEW.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_ot_pt_request_admin_push() FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='ot_pt_request_admin_push' AND tgrelid='public.ot_pt_requests'::regclass) THEN
  CREATE TRIGGER ot_pt_request_admin_push AFTER INSERT ON public.ot_pt_requests FOR EACH ROW EXECUTE FUNCTION public.notify_ot_pt_request_admin_push();
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.ot_pt_notify_sweep() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 UPDATE public.ot_pt_request_notify_jobs SET state='failed',last_error='retry_window_expired',claim_token=NULL,locked_at=NULL WHERE state IN ('pending','sending') AND created_at<=now()-interval '1 day';
 UPDATE public.ot_pt_request_notify_jobs SET state='pending',claim_token=NULL,locked_at=NULL WHERE state='sending' AND locked_at<now()-interval '5 minutes';
 FOR r IN SELECT request_id FROM public.ot_pt_request_notify_jobs WHERE state='pending' AND attempts<5 AND created_at>now()-interval '1 day' ORDER BY created_at LIMIT 20 LOOP
  PERFORM public.ot_pt_notify_fire(r.request_id);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.ot_pt_notify_sweep() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ot_pt_notify_sweep() TO service_role;
SELECT cron.schedule('ot-pt-request-notify-sweep','*/5 * * * *','SELECT public.ot_pt_notify_sweep()') WHERE NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='ot-pt-request-notify-sweep');
COMMIT;
