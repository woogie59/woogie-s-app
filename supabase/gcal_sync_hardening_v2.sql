-- =============================================================================
-- OT 캘린더 자동연동 + google-calendar-sync 보안 보강 v2 (로컬 준비본 — 승인·배포 전 적용 금지)
--
-- v1 준비본(gcal_sync_hardening.sql) 대비 변경:
--   - 공유 비밀을 ALTER DATABASE 평문 설정이 아니라 Supabase Vault에 둔다.
--   - 비밀은 service_role 전용 RPC로만 조회 가능하고 어떤 응답에도 반환되지 않는다.
--   - 신규 함수는 별도 이름(google-calendar-sync-v2)으로 배포해 기존 함수/bookings 경로를
--     그대로 둔다 (완전 가역). URL 전환은 Vault의 gcal_sync_url 값 교체 한 번.
--   - OT webhook 트리거는 vault에서 읽은 값으로 DO 블록이 생성 — 비밀이 SQL 텍스트에
--     나타나지 않는다. 단 트리거 인자(tgargs)에는 헤더가 저장된다 (기존 bookings
--     webhook의 service_role JWT와 동일한 저장 위치/노출 범위: 직접 DB 접근자만).
--
-- 실행 순서: ① ot_calendar_outbox.sql + 이 파일 (url은 처음부터 v2 지정)
--   → ② 함수 v2 배포(verify_jwt 끔) → ③ 프론트 배포(수동 INSERT 경로 제거)
--   → ④ ot_calendar_outbox.sql의 트리거는 ①에 포함 — 단 프론트 배포 전이라도
--   job 적재만 되고 처리는 v2가 하므로 이중 경로 없음(관리자 UI 호출은 RPC가
--   pending 중복을 걸러준다). 구버전 v1 함수는 어떤 단계에서도 신규 호출을 받지 않는다.
-- =============================================================================

-- 1) Vault 보관 (중복 생성 방지). 비밀 값은 DB가 생성하며 어디에도 표시/기록하지 않는다.
SELECT vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'gcal_webhook_secret', 'google-calendar-sync webhook shared secret')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'gcal_webhook_secret');

-- 초기 URL부터 신규 v2 함수를 가리킨다 (무인증 구버전 함수는 어떤 신규 경로도 받지 않음).
-- 따라서 이 파일 적용 직후에는 v2 배포 전까지 관리자 동기화 RPC가 실패한다 — v2 배포가
-- 같은 승인 묶음의 다음 단계인 이유. 기존 bookings webhook은 이 값과 무관하게 계속 동작.
SELECT vault.create_secret('https://qleaffojoqeqlyrwxpeb.supabase.co/functions/v1/google-calendar-sync-v2', 'gcal_sync_url', 'calendar sync edge function url')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'gcal_sync_url');

-- 2) 함수가 비밀을 검증할 때 쓰는 최소권한 조회 (service_role 전용, 그 외 반환 금지)
CREATE OR REPLACE FUNCTION public.internal_gcal_webhook_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'gcal_webhook_secret' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.internal_gcal_webhook_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_gcal_webhook_secret() TO service_role;

-- 3) 관리자 수동 동기화 RPC — Google 호출 없이 작업 큐에 적재하고 fast-path 발화만 한다.
--    처리는 적재 트리거와 같은 함수 경로(claim→Google→done)를 타므로 동작이 일관된다.
--    (v2 배포 전에는 job이 쌓였다가 배포 후 sweeper가 소화 — 이 구간 관리자 동기화
--    버튼 회귀는 지속되며 사용자에게 이미 고지됨)
CREATE OR REPLACE FUNCTION public.admin_block_calendar_sync(
  p_op text,          -- 'INSERT' | 'UPDATE' | 'DELETE'
  p_block_id uuid,
  p_old jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   public.trainer_blocked_slots%ROWTYPE;
  v_payload jsonb;
  v_job uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- 같은 블록·같은 op의 미처리 job이 있으면 중복 적재하지 않는다.
  IF EXISTS (SELECT 1 FROM public.ot_calendar_sync_jobs
             WHERE block_id = p_block_id AND op = p_op AND status IN ('pending','processing')) THEN
    RETURN json_build_object('ok', true, 'queued', false, 'reason', 'already_queued');
  END IF;

  IF p_op IN ('INSERT', 'UPDATE') THEN
    SELECT * INTO v_row FROM public.trainer_blocked_slots WHERE id = p_block_id;
    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'block_not_found');
    END IF;
    IF COALESCE(v_row.kind, 'ot') <> 'ot' THEN
      RETURN json_build_object('ok', true, 'queued', false, 'reason', 'not_ot');
    END IF;
    v_payload := jsonb_build_object('new', to_jsonb(v_row), 'old', p_old);
  ELSE
    v_payload := jsonb_build_object('new', NULL, 'old', p_old);
  END IF;

  INSERT INTO public.ot_calendar_sync_jobs (block_id, op, payload)
  VALUES (p_block_id, p_op, v_payload)
  RETURNING id INTO v_job;

  -- fast-path 즉시 발화 (실패해도 sweeper가 회수)
  PERFORM public.ot_calendar_fire(v_job);

  RETURN json_build_object('ok', true, 'queued', true, 'job_id', v_job);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_block_calendar_sync(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_block_calendar_sync(text, uuid, jsonb) TO authenticated;

-- 4) failed job 복구 RPC — 시도 상한(20회)으로 failed가 된 job을 관리자가 재적재한다.
--    관찰: 대시보드에서 status='failed' 행 조회 (cron.job_run_details의 sweep 오류와
--    함께 확인). failed를 자동 재시도하지 않는 이유: 반복 실패 원인(권한·데이터 오류)을
--    사람이 먼저 보게 하기 위함.
CREATE OR REPLACE FUNCTION public.admin_requeue_ot_calendar_sync_job(p_job_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.ot_calendar_sync_jobs
  SET status = 'pending', attempts = 0, last_error = NULL, locked_at = NULL, claim_token = NULL
  WHERE id = p_job_id AND status = 'failed';
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'job_not_found_or_not_failed');
  END IF;

  PERFORM public.ot_calendar_fire(p_job_id);
  RETURN json_build_object('ok', true, 'requeued', p_job_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_requeue_ot_calendar_sync_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_requeue_ot_calendar_sync_job(uuid) TO authenticated;

-- 비밀 교체(로테이션): vault에서 gcal_webhook_secret 재생성.
-- 적재 트리거/RPC/함수는 매 요청 vault를 읽으므로 추가 조치 없음.
