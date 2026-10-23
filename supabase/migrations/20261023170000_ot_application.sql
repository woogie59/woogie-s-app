-- =============================================================================
-- 오티(OT) 1인용 신청 링크 + 신청 저장소
-- 기획: 2026-10-23 오티 신청 별도 입구 (사용자 승인: 1인용 링크 / 바로 확정 /
--       링크 쓰면 이름만 / 기존 2시간 취소 잠금 / 다음 주 예약 잠금 없음)
-- 원칙: 기존 회원·예약 동작 불변. 신규 테이블 2개 + 신규 RPC 4개만 추가.
--       기존 테이블·정책·함수는 손대지 않음.
-- =============================================================================

-- 1) 오티 링크 (파트너가 대상자에게 1개씩 발급)
CREATE TABLE IF NOT EXISTS public.ot_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label text,                              -- 관리자 메모 (대상자 구분용, 선택)
  max_sessions int NOT NULL DEFAULT 2,     -- 링크당 허용 횟수 (완료+잡아둔 예약 합계)
  revoked_at timestamptz,                  -- 폐기 시각 (NULL이면 유효)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) 오티 신청 (바로 확정). 시간 자리는 trainer_blocked_slots(kind='ot')로도 막혀
--    정규 회원 예약과 겹치지 않고, 기존 Google Calendar OT 동기화를 그대로 탄다.
CREATE TABLE IF NOT EXISTS public.ot_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.ot_links (id) ON DELETE CASCADE,
  date date NOT NULL,
  time text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  block_id uuid REFERENCES public.trainer_blocked_slots (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
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

-- 3) 링크 상태 + 남은 횟수 + 내 신청 목록 (토큰을 아는 사람만 사실상 조회 가능)
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

-- 4) 신청 가능한 달력·시간 재료 (개인정보 없이 날짜·시간만 반환)
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

-- 5) 신청 (바로 확정). 링크 행을 잠가 동시 신청을 직렬화하고,
--    링크당 완료+잡아둔 예약 합계 상한과 슬롯 중복을 서버에서 막는다.
CREATE OR REPLACE FUNCTION public.ot_book(p_token uuid, p_date date, p_time text, p_name text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.ot_links%ROWTYPE;
  v_used int;
  v_block public.trainer_blocked_slots%ROWTYPE;
  v_booking_id uuid;
  v_clean_name text := nullif(btrim(COALESCE(p_name, '')), '');
BEGIN
  IF v_clean_name IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'name_required');
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

  -- 1시간 1명: 정규 예약·관리자 홀드·다른 오티 신청과 겹치면 거부
  IF EXISTS (SELECT 1 FROM public.bookings
             WHERE date = p_date AND time = p_time AND COALESCE(status, '') <> 'cancelled')
     OR EXISTS (SELECT 1 FROM public.trainer_blocked_slots
                WHERE block_date = p_date AND block_time = p_time)
     OR EXISTS (SELECT 1 FROM public.ot_bookings
                WHERE date = p_date AND time = p_time AND status = 'confirmed') THEN
    RETURN json_build_object('ok', false, 'reason', 'slot_taken');
  END IF;

  -- 시간 자리를 OT 홀드로 막아 정규 회원 예약과 캘린더 동기화를 기존 길로 연결
  INSERT INTO public.trainer_blocked_slots (block_date, block_time, label, kind, member_name)
  VALUES (p_date, p_time, 'OT', 'ot', v_clean_name)
  RETURNING * INTO v_block;

  INSERT INTO public.ot_bookings (link_id, date, time, name, block_id)
  VALUES (v_link.id, p_date, p_time, v_clean_name, v_block.id)
  RETURNING id INTO v_booking_id;

  RETURN json_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'block', row_to_json(v_block)
  );
END;
$$;

-- 6) 취소: 정규 회원과 같은 2시간 잠금. 취소하면 자리는 바로 열리고 횟수는 돌아온다.
--    (노쇼 자동 차감은 적용하지 않음 — 사용자 미확정 정책)
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
  SELECT * INTO v_link FROM public.ot_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_booking FROM public.ot_bookings
  WHERE id = p_booking_id AND link_id = v_link.id AND status = 'confirmed'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_start := ((v_booking.date::text || ' ' || v_booking.time)::timestamp AT TIME ZONE 'Asia/Seoul');
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

GRANT EXECUTE ON FUNCTION public.ot_get_link(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ot_get_availability(date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ot_book(uuid, date, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ot_cancel(uuid, uuid) TO anon, authenticated;
