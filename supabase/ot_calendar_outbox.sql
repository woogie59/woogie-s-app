-- =============================================================================
-- OT 캘린더 동기화 outbox (로컬 준비본 — 승인·배포 전 적용 금지)
--
-- 모든 캘린더 작업(생성/수정/삭제)을 하나의 내구 작업 큐로 처리한다.
-- - 적재: trainer_blocked_slots 트리거가 비즈니스 쓰기와 같은 트랜잭션에서 job 생성
--   (블록 행이 삭제돼도 payload에 식별자·기존 google_event_id가 보존됨)
--   · UPDATE는 캘린더 내용에 영향 있는 컬럼(block_date/block_time/member_name/kind)이
--     바뀐 경우에만 적재 — google_event_id write-back 등 메타 변경은 재적재하지 않음
--   · kind가 ot → 비ot로 바뀌면 기존 이벤트 삭제(DELETE job)로 적재
-- - 처리: google-calendar-sync-v2 함수가 job 단위로만 처리.
--   · claim = pending→processing 전이 + claim_token 부여 (단일 승자)
--   · 완료/실패 기록은 같은 claim_token일 때만 반영 — sweeper 회수 뒤 늦게 도착한
--     구 worker의 ack/fail은 0행 매칭으로 무시된다 (stale worker 덮어쓰기 차단)
--   · 실패는 pending 복귀(토큰 해제), sweeper가 회수. 시도 상한(20회) 초과 시
--     failed로 남겨 가시화 — 복구는 admin_requeue_ot_calendar_sync_job RPC
-- - fast-path: 적재 트리거가 즉시 함수 호출(vault 비밀 헤더). 실패/지연은 sweeper가 커버.
-- 신규 오브젝트: 테이블 1, 함수 3(enqueue/fire/sweep), 트리거 1, cron job 1.
-- 기존 테이블·컬럼·webhook·bookings 경로는 무수정. legacy 미동기화 블록 백필 없음.
-- =============================================================================

-- 1) 작업 큐
CREATE TABLE IF NOT EXISTS public.ot_calendar_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL,
  op text NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  payload jsonb NOT NULL,          -- {new: 행, old: 행} 스냅샷 (DELETE는 old만)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  claim_token uuid,                -- 현재 claim 소유자 식별. 회수 시 NULL로 해제
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ot_calendar_sync_jobs_pending_idx
  ON public.ot_calendar_sync_jobs (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ot_calendar_sync_jobs_block_idx
  ON public.ot_calendar_sync_jobs (block_id, created_at);

-- 이 테이블은 서버(service_role/함수) 전용: 클라이언트 역할에는 어떤 권한도 주지 않는다.
ALTER TABLE public.ot_calendar_sync_jobs ENABLE ROW LEVEL SECURITY;  -- 정책 없음 = anon/authenticated 차단
REVOKE ALL ON public.ot_calendar_sync_jobs FROM PUBLIC, anon, authenticated;

-- 2) fast-path 발화 헬퍼: vault의 URL/비밀로 즉시 처리 요청 (실패해도 sweeper가 회수)
CREATE OR REPLACE FUNCTION public.ot_calendar_fire(p_job uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_headers text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'gcal_sync_url' LIMIT 1;
  SELECT jsonb_build_object('Content-type','application/json','x-gcal-webhook-secret', decrypted_secret)::text
    INTO v_headers FROM vault.decrypted_secrets WHERE name = 'gcal_webhook_secret' LIMIT 1;
  IF v_url IS NOT NULL AND v_headers IS NOT NULL THEN
    PERFORM net.http_post(v_url, jsonb_build_object('job_id', p_job), '{}'::jsonb, v_headers::jsonb, 5000);
  END IF;
END;
$$;

-- 3) 적재 트리거 함수 (같은 트랜잭션에서 job 생성 + fast-path 호출)
CREATE OR REPLACE FUNCTION public.ot_calendar_enqueue_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid;
BEGIN
  -- kind 전이 ot → 비ot: 기존 이벤트 정리용 DELETE job으로 적재
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.kind, 'ot') = 'ot' AND COALESCE(NEW.kind, 'ot') <> 'ot' THEN
    INSERT INTO public.ot_calendar_sync_jobs (block_id, op, payload)
    VALUES (OLD.id, 'DELETE', jsonb_build_object('new', NULL, 'old', to_jsonb(OLD)))
    RETURNING id INTO v_job;
    PERFORM public.ot_calendar_fire(v_job);
    RETURN NEW;
  END IF;

  -- kind='ot' 만 동기화 대상 (hold 등은 제외)
  IF (TG_OP = 'DELETE' AND COALESCE(OLD.kind, 'ot') <> 'ot')
     OR (TG_OP <> 'DELETE' AND COALESCE(NEW.kind, 'ot') <> 'ot') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- UPDATE는 캘린더 내용을 바꾸는 컬럼이 실제로 바뀐 경우에만 적재한다.
  -- (google_event_id write-back·updated_at 등 메타 변경은 재적재하지 않음 — 루프 방지)
  IF TG_OP = 'UPDATE'
     AND NEW.block_date  IS NOT DISTINCT FROM OLD.block_date
     AND NEW.block_time  IS NOT DISTINCT FROM OLD.block_time
     AND NEW.member_name IS NOT DISTINCT FROM OLD.member_name
     AND NEW.kind        IS NOT DISTINCT FROM OLD.kind THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ot_calendar_sync_jobs (block_id, op, payload)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    jsonb_build_object(
      'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
      'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
    )
  )
  RETURNING id INTO v_job;

  PERFORM public.ot_calendar_fire(v_job);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 클라이언트 역할 직접 EXECUTE 차단 (Supabase 기본 ACL이 anon/authenticated/PUBLIC에
-- EXECUTE를 자동 부여하므로 명시 REVOKE 필요. 트리거·cron·RPC 경유 실행에는 영향 없음)
REVOKE ALL ON FUNCTION public.ot_calendar_enqueue_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ot_calendar_fire(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ot_calendar_sync_sweep() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ot_calendar_enqueue ON public.trainer_blocked_slots;
CREATE TRIGGER ot_calendar_enqueue
AFTER INSERT OR UPDATE OR DELETE ON public.trainer_blocked_slots
FOR EACH ROW EXECUTE FUNCTION public.ot_calendar_enqueue_sync();

-- 4) sweeper: 정체된 processing 회수 + pending 재발화
--    cron 5분 주기. 정상 경로는 적재 시 fast-path(<1s)가 담당하고 sweeper는
--    크래시·실패 회수 전용이므로, 회수 지연은 최대 약 10분(잠금 5분 + 주기 5분)이고
--    유휴 호출은 1분 주기 대비 1/5다.
CREATE OR REPLACE FUNCTION public.ot_calendar_sync_sweep()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_count int := 0;
BEGIN
  -- 5분 이상 processing에 멈춘 job 회수 (처리 중 크래시 대비). claim_token을 해제해
  -- 구 worker의 늦은 ack/fail이 더는 매칭되지 않게 한다.
  UPDATE public.ot_calendar_sync_jobs
  SET status = 'pending', locked_at = NULL, claim_token = NULL
  WHERE status = 'processing' AND locked_at < now() - interval '5 minutes';

  FOR v_job IN
    SELECT id FROM public.ot_calendar_sync_jobs
    WHERE status = 'pending' AND attempts < 20
    ORDER BY created_at
    LIMIT 25
  LOOP
    PERFORM public.ot_calendar_fire(v_job.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 5) cron 등록 (5분 — 사유는 4번 주석. pg_cron이 있을 때만 등록)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ot-calendar-sync-sweep') THEN
      PERFORM cron.schedule('ot-calendar-sync-sweep', '*/5 * * * *', $c$SELECT public.ot_calendar_sync_sweep()$c$);
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron 없음 — sweep 등록 생략 (로컬 검증 환경)';
  END IF;
END $$;
