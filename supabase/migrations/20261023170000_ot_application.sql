-- =============================================================================
-- 오티(OT) 1인용 신청 링크 + 신청 저장소  [rev 3 — 2026-10-23 독립 리뷰 + 사용자 개인링크 방향 반영]
-- 기획: 2026-10-23 오티 신청 별도 입구 (사용자 승인: 1인용 링크 / 바로 확정 /
--       링크 쓰면 이름만 / 기존 2시간 취소 잠금 / 다음 주 예약 잠금 없음)
-- 원칙: 기존 회원·예약 동작 불변. 신규 테이블 2개 + 신규 함수만 추가.
--       기존 테이블·정책·함수는 손대지 않음.
-- rev 2 (독립 리뷰 필수수정):
--   - ot_book 서버 검증 강화: 과거날짜/비정상시간('99:99')/새벽/휴무일/영업외시간/
--     1시간 리드타임/이름 길이 — 프론트 검사에 의존하지 않음
--   - ot_cancel: 비정상 time 값의 timestamp 파싱 실패로 예약 고착되던 경로 제거
--     (book에서 정규화된 값만 저장 + cancel에서도 재검증)
--   - 모든 신규 함수: PUBLIC EXECUTE 회수 후 anon/authenticated 명시 grant
--   - trainer_blocked_slots(block_date, block_time) 기존 유니크 인덱스를 오티 신청의
--     슬롯 원자성 장치로 사용 (unique_violation → slot_taken).
--     ※ 이것은 오티/관리자홀드 간 경쟁만 원자적으로 막는다. 정규 회원 예약(bookings
--     직접 insert)은 이 인덱스를 타지 않으므로 정규예약↔오티 경쟁은 여전히
--     "insert 전 재조회" 수준 — 완전한 교차 writer 원자성은 기존 회원 예약 경로
--     변경이 필요하여 별도 승인 대상으로 남김 (REVIEW.md 참조).
-- =============================================================================

-- 1) 오티 링크 (파트너가 대상자에게 1개씩 발급)
CREATE TABLE IF NOT EXISTS public.ot_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  member_name text NOT NULL,               -- 오티 대상자 이름 (관리자가 발급 시 입력; 환영 화면에 표시)
  label text,                              -- 관리자 메모 (선택)
  max_sessions int NOT NULL DEFAULT 2,     -- 링크당 허용 횟수 (완료+잡아둔 예약 합계)
  CONSTRAINT ot_links_member_name_len CHECK (char_length(btrim(member_name)) BETWEEN 1 AND 30),
  revoked_at timestamptz,                  -- 폐기 시각 (NULL이면 유효)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) 오티 신청 (바로 확정). 시간 자리는 trainer_blocked_slots(kind='ot')로도 막혀
--    정규 회원 예약과 겹치지 않고, 기존 Google Calendar OT 동기화를 그대로 탄다.
--    calendar_synced_at / admin_notified_at: 부수효과(캘린더/푸시)는 클라이언트
--    fire-and-forget이라 누락될 수 있어, 보냈다는 보고를 서버에 기록해 관리자
--    화면에서 누락을 발견·수동 재시도할 수 있게 한다.
CREATE TABLE IF NOT EXISTS public.ot_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.ot_links (id) ON DELETE CASCADE,
  date date NOT NULL,
  time text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  block_id uuid REFERENCES public.trainer_blocked_slots (id) ON DELETE SET NULL,
  calendar_synced_at timestamptz,          -- 캘린더 등록/삭제 시도가 보고된 시각
  admin_notified_at timestamptz,           -- 관리자 푸시 발송이 보고된 시각
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT ot_bookings_time_format CHECK (time ~ '^([01][0-9]|2[0-3]):00$'),
  CONSTRAINT ot_bookings_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 30)
);

CREATE INDEX IF NOT EXISTS ot_bookings_link_idx ON public.ot_bookings (link_id);
CREATE INDEX IF NOT EXISTS ot_bookings_date_idx ON public.ot_bookings (date);

ALTER TABLE public.ot_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ot_bookings ENABLE ROW LEVEL SECURITY;

-- 직접 테이블 접근은 관리자만. 오티 회원(비로그인)은 아래 RPC로만 읽기·쓰기.
DROP POLICY IF EXISTS ot_links_admin_all ON public.ot_links;
CREATE POLICY ot_links_admin_all ON public.ot_links
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS ot_bookings_admin_all ON public.ot_bookings;
CREATE POLICY ot_bookings_admin_all ON public.ot_bookings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 3) 특정 날짜의 실제 오픈 시간(정시 hour 배열). 프론트의 resolveDateAvailability와
--    같은 우선순위: 날짜별 오픈 지정 → 휴무일 → 주간 템플릿. 닫힌 날은 NULL.
CREATE OR REPLACE FUNCTION public._ot_available_hours(p_date date)
RETURNS int[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_open record;
  v_setting record;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT available_hours INTO v_open FROM public.trainer_open_dates WHERE date = p_date;
  IF FOUND THEN
    RETURN COALESCE((SELECT array_agg(value::int) FROM jsonb_array_elements_text(v_open.available_hours) AS t(value)), '{}'::int[]);
  END IF;

  IF EXISTS (SELECT 1 FROM public.trainer_holidays WHERE date = p_date) THEN
    RETURN NULL;
  END IF;

  SELECT available_hours, off INTO v_setting
  FROM public.trainer_settings
  WHERE day_of_week = extract(dow FROM p_date)::int;
  IF NOT FOUND OR v_setting.off THEN
    RETURN NULL;
  END IF;
  RETURN COALESCE((SELECT array_agg(value::int) FROM jsonb_array_elements_text(v_setting.available_hours) AS t(value)), '{}'::int[]);
END;
$$;

-- 4) 링크 상태 + 남은 횟수 + 내 신청 목록 (토큰을 아는 사람만 사실상 조회 가능)
CREATE OR REPLACE FUNCTION public.ot_get_link(p_token uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.ot_links%ROWTYPE;
  v_used int;
BEGIN
  SELECT * INTO v_link FROM public.ot_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_link.revoked_at IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'revoked');
  END IF;
  SELECT count(*) INTO v_used
  FROM public.ot_bookings
  WHERE link_id = v_link.id AND status IN ('confirmed', 'completed');
  RETURN json_build_object(
    'ok', true,
    'member_name', v_link.member_name,
    'max_sessions', v_link.max_sessions,
    'remaining', GREATEST(0, v_link.max_sessions - v_used),
    'bookings', COALESCE((
      SELECT json_agg(json_build_object(
        'id', b.id, 'date', b.date, 'time', b.time, 'name', b.name, 'status', b.status
      ) ORDER BY b.date, b.time)
      FROM public.ot_bookings b
      WHERE b.link_id = v_link.id AND b.status = 'confirmed'
    ), '[]'::json)
  );
END;
$$;

-- 5) 신청 가능한 달력·시간 재료 (개인정보 없이 날짜·시간만 반환)
CREATE OR REPLACE FUNCTION public.ot_get_availability(p_from date, p_to date)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(
    'settings', COALESCE((SELECT json_agg(row_to_json(s)) FROM (
      SELECT day_of_week, available_hours, off FROM public.trainer_settings
    ) s), '[]'::json),
    'holidays', COALESCE((SELECT json_agg(h.date) FROM public.trainer_holidays h
      WHERE h.date BETWEEN p_from AND p_to), '[]'::json),
    'open_dates', COALESCE((SELECT json_agg(row_to_json(o)) FROM (
      SELECT date, available_hours FROM public.trainer_open_dates
      WHERE date BETWEEN p_from AND p_to
    ) o), '[]'::json),
    'blocked', COALESCE((SELECT json_agg(json_build_object('date', b.block_date, 'time', b.block_time))
      FROM public.trainer_blocked_slots b
      WHERE b.block_date BETWEEN p_from AND p_to), '[]'::json),
    'taken', COALESCE((SELECT json_agg(json_build_object('date', bk.date, 'time', bk.time))
      FROM public.bookings bk
      WHERE bk.date BETWEEN p_from AND p_to
        AND COALESCE(bk.status, '') <> 'cancelled'), '[]'::json),
    'ot_taken', COALESCE((SELECT json_agg(json_build_object('date', ob.date, 'time', ob.time))
      FROM public.ot_bookings ob
      WHERE ob.date BETWEEN p_from AND p_to AND ob.status = 'confirmed'), '[]'::json)
  );
END;
$$;

-- 6) 신청 (바로 확정). 모든 입력을 서버에서 검증한다 (프론트 검사는 보조일 뿐).
--    링크 행 FOR UPDATE 잠금 + trainer_blocked_slots 유니크 인덱스로
--    같은 링크/다른 링크/관리자 홀드 간 경쟁을 직렬화한다.
CREATE OR REPLACE FUNCTION public.ot_book(p_token uuid, p_date date, p_time text)
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
BEGIN
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
  IF EXISTS (SELECT 1 FROM public.bookings
             WHERE date = p_date AND time = v_time AND COALESCE(status, '') <> 'cancelled')
     OR EXISTS (SELECT 1 FROM public.trainer_blocked_slots
                WHERE block_date = p_date AND block_time = v_time)
     OR EXISTS (SELECT 1 FROM public.ot_bookings
                WHERE date = p_date AND time = v_time AND status = 'confirmed') THEN
    RETURN json_build_object('ok', false, 'reason', 'slot_taken');
  END IF;

  -- 시간 자리를 OT 홀드로 막는다. (block_date, block_time) 기존 유니크 인덱스가
  -- 동시 삽입을 원자적으로 거부 → unique_violation은 slot_taken으로 변환.
  -- 이름은 공용 테이블(trainer_blocked_slots, authenticated 전체 SELECT 정책)에 쓰지 않는다.
  -- 대상자 이름은 토큰으로만 조회되는 ot_links/ot_bookings에만 둔다 (최소 데이터).
  INSERT INTO public.trainer_blocked_slots (block_date, block_time, label, kind)
  VALUES (p_date, v_time, 'OT', 'ot')
  RETURNING * INTO v_block;

  INSERT INTO public.ot_bookings (link_id, date, time, name, block_id)
  VALUES (v_link.id, p_date, v_time, v_link.member_name, v_block.id)
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

-- 7) 취소: 정규 회원과 같은 2시간 잠금. 취소하면 자리는 바로 열리고 횟수는 돌아온다.
--    (노쇼 자동 차감은 적용하지 않음 — 사용자 미확정 정책)
--    ※ trainer_blocked_slots 행 DELETE 포함 — 실데이터 실행 승인 전 리뷰 대상.
CREATE OR REPLACE FUNCTION public.ot_cancel(p_token uuid, p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.ot_links%ROWTYPE;
  v_booking public.ot_bookings%ROWTYPE;
  v_block public.trainer_blocked_slots%ROWTYPE;
  v_start timestamptz;
BEGIN
  SELECT * INTO v_link FROM public.ot_links WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_booking FROM public.ot_bookings
  WHERE id = p_booking_id AND link_id = v_link.id AND status = 'confirmed'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- 저장된 값은 book에서 정규화됐지만, 방어적으로 다시 검증 (파싱 실패 고착 방지)
  IF v_booking.time !~ '^([01][0-9]|2[0-3]):00$' THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_booking');
  END IF;
  v_start := ((v_booking.date::text || ' ' || v_booking.time)::timestamp AT TIME ZONE 'Asia/Seoul');
  IF v_start IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_booking');
  END IF;
  IF v_start - now() < interval '2 hours' THEN
    RETURN json_build_object('ok', false, 'reason', 'locked');
  END IF;

  UPDATE public.ot_bookings
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = v_booking.id;

  IF v_booking.block_id IS NOT NULL THEN
    DELETE FROM public.trainer_blocked_slots WHERE id = v_booking.block_id
    RETURNING * INTO v_block;
  END IF;

  RETURN json_build_object('ok', true, 'old_block', COALESCE(row_to_json(v_block), 'null'::json));
END;
$$;

-- 8) (제거됨) 클라이언트 부수효과 보고(ot_report_sync)는 공개 페이지의 임의 외부호출
--    제거와 함께 폐기. 동기화 시각은 서버 경로(ot-booking-notify, google-calendar-sync)가 기록.

-- 9) 관리자 완료 처리: confirmed → completed (횟수 계산은 confirmed+completed라
--    전이해도 링크 상한에는 영향 없음. 기록 정합성용)
CREATE OR REPLACE FUNCTION public.ot_admin_complete(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE public.ot_bookings SET status = 'completed'
  WHERE id = p_booking_id AND status = 'confirmed';
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- 10) 관리자 취소: 2시간 잠금 없이 취소 + 자리 해제 (회원 취소와 별개 경로).
--     링크 폐기(revoke)와 다름: 폐기는 링크만 닫고 신청은 유지.
--     ※ trainer_blocked_slots 행 DELETE 포함 — 실데이터 실행 승인 전 리뷰 대상.
CREATE OR REPLACE FUNCTION public.ot_admin_cancel(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking public.ot_bookings%ROWTYPE;
  v_block public.trainer_blocked_slots%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_booking FROM public.ot_bookings
  WHERE id = p_booking_id AND status = 'confirmed'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  UPDATE public.ot_bookings
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = v_booking.id;

  IF v_booking.block_id IS NOT NULL THEN
    DELETE FROM public.trainer_blocked_slots WHERE id = v_booking.block_id
    RETURNING * INTO v_block;
  END IF;

  RETURN json_build_object('ok', true, 'old_block', COALESCE(row_to_json(v_block), 'null'::json));
END;
$$;

-- 11) (제거됨) 지난 신청 일괄/자동 완료 함수는 만들지 않는다.
--     시간이 지났다고 완료 처리하면 미확인 노쇼까지 완료가 되어, 아직 정해지지 않은
--     노쇼 정책을 우회한다. 완료 전이는 관리자가 출석을 확인한 뒤 건별로
--     ot_admin_complete()를 호출하는 것만 허용한다.

-- PUBLIC 기본 실행권 회수 후 명시 grant (독립 리뷰 권고)
REVOKE ALL ON FUNCTION public._ot_available_hours(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ot_get_link(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ot_get_availability(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ot_book(uuid, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ot_cancel(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ot_admin_complete(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ot_admin_cancel(uuid) FROM PUBLIC;

-- 오티 회원(비로그인 포함)이 호출하는 것
GRANT EXECUTE ON FUNCTION public.ot_get_link(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ot_get_availability(date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ot_book(uuid, date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ot_cancel(uuid, uuid) TO anon, authenticated;
-- 관리자 전용 (로그인 + 함수 내부 role 검사 이중 방어)
GRANT EXECUTE ON FUNCTION public.ot_admin_complete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ot_admin_cancel(uuid) TO authenticated;
-- 내부 헬퍼는 외부 호출 불필요 (grant 없음)
