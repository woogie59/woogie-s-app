-- =============================================================================
-- google-calendar-sync 보안 보강 (로컬 준비본 — 승인·배포 전 적용 금지)
--
-- 배경: google-calendar-sync는 외부(구글 캘린더) 쓰기 권한을 가진 함수인데
-- 무인증 공개 POST가 가능했다(verify_jwt=false + 함수 내부 인증 없음).
-- 실제 event id를 알면 위조 DELETE, 임의 INSERT가 가능한 구조. 악용 확인은 없음.
--
-- 보강 내용:
--   1) 함수가 x-gcal-webhook-secret 공유 비밀을 요구 (코드는 이미 준비됨)
--   2) 브라우저의 직접 호출을 관리자 RPC로 대체 — 아래 admin_block_calendar_sync.
--      관리자 화면(수동 OT, 오티 링크 재등록)은 이 RPC를 거쳐 서버가 함수를 호출.
--
-- 실행 순서 (같은 배포):
--   1) Dashboard → Database → Extensions: pg_net 활성화 확인
--   2) 이 파일 실행 (SQL Editor)
--   3) ALTER DATABASE postgres SET app.gcal_sync_url = 'https://<ref>.supabase.co/functions/v1/google-calendar-sync';
--      ALTER DATABASE postgres SET app.gcal_sync_secret = '<랜덤 긴 값>';  (대시보드 SQL로)
--   4) Edge Secrets에 GCAL_WEBHOOK_SECRET 동일 값 설정 후 함수 배포
--   5) 앱 코드 배포 (util이 RPC를 부르는 버전)
-- =============================================================================

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
  v_url   text;
  v_secret text;
  payload jsonb;
BEGIN
  -- 관리자만
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_url := current_setting('app.gcal_sync_url', true);
  v_secret := current_setting('app.gcal_sync_secret', true);
  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RETURN json_build_object('ok', false, 'error', 'sync_not_configured');
  END IF;

  -- 실재 행은 서버에서 읽는다 (클라이언트가 보낸 값을 신뢰하지 않음)
  IF p_op IN ('INSERT', 'UPDATE') THEN
    SELECT * INTO v_row FROM public.trainer_blocked_slots WHERE id = p_block_id;
    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'block_not_found');
    END IF;
    payload := jsonb_build_object(
      'type', p_op, 'table', 'trainer_blocked_slots', 'schema', 'public',
      'record', to_jsonb(v_row), 'old_record', p_old
    );
  ELSE
    payload := jsonb_build_object(
      'type', 'DELETE', 'table', 'trainer_blocked_slots', 'schema', 'public',
      'record', NULL, 'old_record', p_old
    );
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-gcal-webhook-secret', v_secret
    ),
    body := payload
  );
  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_block_calendar_sync(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_block_calendar_sync(text, uuid, jsonb) TO authenticated;
