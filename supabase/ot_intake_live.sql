-- ot_intake_live.sql — OT 신청 문진(운동 목표 / 배우고 싶은 운동·부위 / 특이사항) 저장 + 보유기간 삭제 (추가 전용, 1 트랜잭션)
-- 승인 범위: 사용자 1번 선택 (phonemsg-01M6RFZFM55WHEBH9R3DG2F2TW, 제안 원문 phonemsg-01M6RFY9MJXMTJBCNFBWFHM4Q0)
--   - 모든 문진은 '(선택)', 비워도 신청 가능
--   - 특이사항(건강정보)은 입력 칸 옆의 별도 동의 체크가 있을 때만 저장
--   - 답변은 관리자 화면에서만 확인, 푸시·캘린더 본문에 넣지 않음
--   - OT 날짜 경과 또는 링크 폐기 후 30일 이내에 문진 답변 삭제 (ot_purge_intake, 일일 실행)
-- 기존 회원·예약·링크 데이터의 변경/삭제 없음. 문진 컬럼의 NULL 처리만 수행한다.
BEGIN;

-- 1) 문진 컬럼 (모두 NULL 가능 — 미입력 신청은 기존과 동일하게 동작)
ALTER TABLE public.ot_bookings
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS interests text,
  ADD COLUMN IF NOT EXISTS health_note text,
  ADD COLUMN IF NOT EXISTS health_consented_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ot_bookings_goal_len') THEN
    ALTER TABLE public.ot_bookings ADD CONSTRAINT ot_bookings_goal_len
      CHECK (goal IS NULL OR char_length(btrim(goal)) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ot_bookings_interests_len') THEN
    ALTER TABLE public.ot_bookings ADD CONSTRAINT ot_bookings_interests_len
      CHECK (interests IS NULL OR char_length(btrim(interests)) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ot_bookings_health_note_len') THEN
    ALTER TABLE public.ot_bookings ADD CONSTRAINT ot_bookings_health_note_len
      CHECK (health_note IS NULL OR char_length(btrim(health_note)) <= 200);
  END IF;
  -- fail closed: 동의 시각 없이는 건강정보를 저장할 수 없다.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ot_bookings_health_requires_consent') THEN
    ALTER TABLE public.ot_bookings ADD CONSTRAINT ot_bookings_health_requires_consent
      CHECK (health_note IS NULL OR health_consented_at IS NOT NULL);
  END IF;
END $$;

-- 2) ot_book 확장: 기존 (uuid, date, text) 시그니처는 삭제하고 문진 파라미터 포함 버전으로 교체.
--    새 파라미터는 기본값 NULL/false라 기존 3-파라미터 호출과 동일하게 동작한다.
--    문진 길이·동의 유무는 화면과 무관하게 서버가 최종 검사한다.
DROP FUNCTION IF EXISTS public.ot_book(uuid, date, text);

CREATE FUNCTION public.ot_book(
  p_token uuid,
  p_date date,
  p_time text,
  p_goal text DEFAULT NULL,
  p_interests text DEFAULT NULL,
  p_health_note text DEFAULT NULL,
  p_health_consent boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.ot_links%ROWTYPE;
  v_used int;
  v_block public.trainer_blocked_slots%ROWTYPE;
  v_booking_id uuid;
  v_time text;
  v_hour int;
  v_hours int[];
  v_start timestamptz;
  v_goal text := NULLIF(btrim(COALESCE(p_goal, '')), '');
  v_interests text := NULLIF(btrim(COALESCE(p_interests, '')), '');
  v_health text := NULLIF(btrim(COALESCE(p_health_note, '')), '');
BEGIN
  -- 문진 검증: 길이 제한은 서버가 최종 검사
  IF v_goal IS NOT NULL AND char_length(v_goal) > 200 THEN
    RETURN json_build_object('ok', false, 'reason', 'goal_too_long');
  END IF;
  IF v_interests IS NOT NULL AND char_length(v_interests) > 200 THEN
    RETURN json_build_object('ok', false, 'reason', 'interests_too_long');
  END IF;
  IF v_health IS NOT NULL AND char_length(v_health) > 200 THEN
    RETURN json_build_object('ok', false, 'reason', 'health_too_long');
  END IF;
  -- 건강정보는 별도 동의 없이 절대 저장하지 않는다 (제23조 별도 동의).
  IF v_health IS NOT NULL AND NOT COALESCE(p_health_consent, false) THEN
    RETURN json_build_object('ok', false, 'reason', 'consent_required');
  END IF;

  -- 날짜: 오늘(KST) 이전 불가
  IF p_date IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_date');
  END IF;
  IF p_date < (now() AT TIME ZONE 'Asia/Seoul')::date THEN
    RETURN json_build_object('ok', false, 'reason', 'past_date');
  END IF;

  -- 시간: 정시('HH:00')만 허용. '99:99' 같은 비정상 값 차단.
  v_time := btrim(COALESCE(p_time, ''));
  IF v_time ~ '^\d{1,2}:\d{2}$' THEN
    v_time := lpad(split_part(v_time, ':', 1), 2, '0') || ':' || split_part(v_time, ':', 2);
  END IF;
  IF v_time !~ '^([01][0-9]|2[0-3]):00$' THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_time');
  END IF;
  v_hour := substring(v_time FROM 1 FOR 2)::int;

  -- 영업시간/휴무/날짜별 오픈 규칙 안의 시간만 허용
  v_hours := public._ot_available_hours(p_date);
  IF v_hours IS NULL OR NOT (v_hour = ANY(v_hours)) THEN
    RETURN json_build_object('ok', false, 'reason', 'unavailable');
  END IF;

  -- 기존 회원과 같은 1시간 리드타임
  v_start := ((p_date::text || ' ' || v_time)::timestamp AT TIME ZONE 'Asia/Seoul');
  IF v_start - now() < interval '1 hour' THEN
    RETURN json_build_object('ok', false, 'reason', 'too_soon');
  END IF;

  SELECT * INTO v_link FROM public.ot_links WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_link.revoked_at IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'revoked');
  END IF;

  SELECT count(*) INTO v_used
  FROM public.ot_bookings
  WHERE link_id = v_link.id AND status IN ('confirmed', 'completed');
  IF v_used >= v_link.max_sessions THEN
    RETURN json_build_object('ok', false, 'reason', 'no_remaining');
  END IF;

  -- 1시간 1명: 정규 예약·관리자 홀드·다른 오티 신청과 겹치면 거부 (재조회 방어)
  -- ※ bookings.date 는 라이브 스키마에서 text (2026-10-23 실측) — text 비교 + 시간 정규화
  IF EXISTS (SELECT 1 FROM public.bookings
             WHERE left(btrim(date), 10) = p_date::text
               AND public._normalize_booking_time(time) = v_time
               AND COALESCE(status, '') <> 'cancelled')
     OR EXISTS (SELECT 1 FROM public.trainer_blocked_slots
                WHERE block_date = p_date AND block_time = v_time)
     OR EXISTS (SELECT 1 FROM public.ot_bookings
                WHERE date = p_date AND time = v_time AND status = 'confirmed') THEN
    RETURN json_build_object('ok', false, 'reason', 'slot_taken');
  END IF;

  -- 시간 자리를 OT 홀드로 막는다. (block_date, block_time) 기존 유니크 인덱스가
  -- 동시 삽입을 원자적으로 거부 → unique_violation은 slot_taken으로 변환.
  -- 이름은 공용 테이블(trainer_blocked_slots, authenticated 전체 SELECT 정책)에 쓰지 않는다.
  INSERT INTO public.trainer_blocked_slots (block_date, block_time, label, kind)
  VALUES (p_date, v_time, 'OT', 'ot')
  RETURNING * INTO v_block;

  -- 문진: 비어 있으면 NULL로 둔다. 건강정보는 동의가 확인될 때만 시각과 함께 저장.
  INSERT INTO public.ot_bookings (link_id, date, time, name, block_id, goal, interests, health_note, health_consented_at)
  VALUES (
    v_link.id, p_date, v_time, v_link.member_name, v_block.id,
    v_goal,
    v_interests,
    CASE WHEN v_health IS NOT NULL THEN v_health END,
    CASE WHEN v_health IS NOT NULL THEN now() END
  )
  RETURNING id INTO v_booking_id;

  RETURN json_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'block', row_to_json(v_block)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'reason', 'slot_taken');
END;
$$;

-- 3) 보유기간 삭제: OT 날짜가 지난 지 30일이 됐거나 링크가 폐기된 지 30일이 된 신청 건의
--    문진 답변만 NULL로 지운다. 신청 행·링크·회원 데이터는 건드리지 않는다.
--    호출 주체: pg_cron 일일 실행 (아래 cron.schedule — booking_notify_sweep와 같은 패턴).
CREATE OR REPLACE FUNCTION public.ot_purge_intake()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH updated AS (
    UPDATE public.ot_bookings b
    SET goal = NULL,
        interests = NULL,
        health_note = NULL,
        health_consented_at = NULL
    FROM public.ot_links l
    WHERE b.link_id = l.id
      AND (b.goal IS NOT NULL OR b.interests IS NOT NULL OR b.health_note IS NOT NULL OR b.health_consented_at IS NOT NULL)
      AND (
        b.date <= (now() AT TIME ZONE 'Asia/Seoul')::date - 30
        OR (l.revoked_at IS NOT NULL AND l.revoked_at <= now() - interval '30 days')
      )
    RETURNING b.id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN json_build_object('ok', true, 'purged', v_count);
END;
$$;

-- 4) 권한: ot_book(신 시그니처)는 공개 신청 페이지가 호출, purge는 service_role 전용.
REVOKE ALL ON FUNCTION public.ot_book(uuid, date, text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ot_purge_intake() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ot_book(uuid, date, text, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ot_purge_intake() TO service_role;

-- 5) 일일 실행 (00:10 UTC = 09:10 KST). 이미 있으면 다시 잡지 않는다.
SELECT cron.schedule('ot-intake-purge-daily', '10 0 * * *', 'SELECT public.ot_purge_intake()')
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ot-intake-purge-daily');

COMMIT;
