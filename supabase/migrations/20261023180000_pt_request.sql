-- 피티 등록 신청 (첫 PT 희망 일시, 관리자 확인형) — 2026-10-23 사용자 승인 방향
-- 범위: 새 테이블 ot_pt_requests + 새 RPC 3건 + ot_get_link 반환 확장(후보A 함수만).
-- 기존 테이블·정책 변경 없음. 슬롯 점유 없음(블록 생성 X). 외부 알림/캘린더 없음.
-- 확인 후 실제 예약 생성은 관리자가 기존 예약 화면에서 수동 처리(자동 생성 범위 밖).

-- 1) 테이블
CREATE TABLE IF NOT EXISTS public.ot_pt_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.ot_links (id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  requested_time text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT ot_pt_requests_time_format CHECK (requested_time ~ '^([01][0-9]|2[0-3]):00$')
);

CREATE INDEX IF NOT EXISTS ot_pt_requests_link_idx ON public.ot_pt_requests (link_id);
-- 링크당 활성 신청은 1건: 검토 중(requested)이거나 센터가 확인(accepted)한 신청이 있으면 추가 신청 불가
-- (회원 취소/거절된 건은 다시 신청 가능)
CREATE UNIQUE INDEX IF NOT EXISTS ot_pt_requests_one_active
  ON public.ot_pt_requests (link_id) WHERE status IN ('requested', 'accepted');

ALTER TABLE public.ot_pt_requests ENABLE ROW LEVEL SECURITY;

-- 직접 테이블 접근은 관리자만. 회원(비로그인)은 아래 RPC로만 읽기·쓰기.
DROP POLICY IF EXISTS ot_pt_requests_admin_all ON public.ot_pt_requests;
CREATE POLICY ot_pt_requests_admin_all ON public.ot_pt_requests
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 2) 회원 신청: 전 회차 출석 완료(completed)한 링크만. 슬롯 점유 없이 '신청'만 남긴다.
CREATE OR REPLACE FUNCTION public.ot_request_pt(p_token uuid, p_date date, p_time text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.ot_links%ROWTYPE;
  v_used int;
  v_pending int;
  v_time text;
  v_hour int;
  v_hours int[];
  v_start timestamptz;
  v_id uuid;
BEGIN
  IF p_date IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_date');
  END IF;
  IF p_date < (now() AT TIME ZONE 'Asia/Seoul')::date THEN
    RETURN json_build_object('ok', false, 'reason', 'past_date');
  END IF;

  v_time := btrim(COALESCE(p_time, ''));
  IF v_time ~ '^\d{1,2}:\d{2}$' THEN
    v_time := lpad(split_part(v_time, ':', 1), 2, '0') || ':' || split_part(v_time, ':', 2);
  END IF;
  IF v_time !~ '^([01][0-9]|2[0-3]):00$' THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_time');
  END IF;
  v_hour := substring(v_time FROM 1 FOR 2)::int;

  v_hours := public._ot_available_hours(p_date);
  IF v_hours IS NULL OR NOT (v_hour = ANY(v_hours)) THEN
    RETURN json_build_object('ok', false, 'reason', 'unavailable');
  END IF;

  v_start := ((p_date::text || ' ' || v_time)::timestamp AT TIME ZONE 'Asia/Seoul');
  IF v_start - now() < interval '1 hour' THEN
    RETURN json_build_object('ok', false, 'reason', 'too_soon');
  END IF;

  SELECT * INTO v_link FROM public.ot_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_link.revoked_at IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'revoked');
  END IF;

  -- 전 회차 소진(모두 completed) 후에만 신청 가능: 미출석 confirmed가 남아 있으면 불가
  SELECT count(*) INTO v_used FROM public.ot_bookings
  WHERE link_id = v_link.id AND status IN ('confirmed', 'completed');
  SELECT count(*) INTO v_pending FROM public.ot_bookings
  WHERE link_id = v_link.id AND status = 'confirmed';
  IF v_used < v_link.max_sessions OR v_pending > 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'not_completed');
  END IF;

  -- 진행 중이거나 센터가 확인한 신청이 있으면 추가 신청 불가 (UI는 accepted 뒤 재신청 버튼을 노출하지 않음 — 동일 기준)
  IF EXISTS (SELECT 1 FROM public.ot_pt_requests WHERE link_id = v_link.id AND status = 'requested') THEN
    RETURN json_build_object('ok', false, 'reason', 'already_requested');
  END IF;
  IF EXISTS (SELECT 1 FROM public.ot_pt_requests WHERE link_id = v_link.id AND status = 'accepted') THEN
    RETURN json_build_object('ok', false, 'reason', 'already_accepted');
  END IF;

  -- 희망 일시가 실제로 비는 시간인지(정규예약·홀드·OT와 충돌) 확인만 한다. 점유하지 않음.
  IF EXISTS (SELECT 1 FROM public.bookings
             WHERE left(btrim(date), 10) = p_date::text
               AND public._normalize_booking_time(time) = v_time
               AND COALESCE(status, '') <> 'cancelled')
     OR EXISTS (SELECT 1 FROM public.trainer_blocked_slots
                WHERE block_date = p_date AND block_time = v_time) THEN
    RETURN json_build_object('ok', false, 'reason', 'slot_taken');
  END IF;

  INSERT INTO public.ot_pt_requests (link_id, requested_date, requested_time)
  VALUES (v_link.id, p_date, v_time)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'request_id', v_id, 'date', p_date, 'time', v_time);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'reason', 'already_requested');
END;
$$;

-- 3) 회원 신청 취소: requested 상태만
CREATE OR REPLACE FUNCTION public.ot_cancel_pt_request(p_token uuid, p_request_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.ot_links%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM public.ot_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  UPDATE public.ot_pt_requests
  SET status = 'cancelled', decided_at = now()
  WHERE id = p_request_id AND link_id = v_link.id AND status = 'requested';
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- 4) 관리자 검토 승인/거절 — 승인(accepted)은 '시간 확정'이 아니라 검토 통과. 실제 예약은 관리자가 별도 등록
CREATE OR REPLACE FUNCTION public.ot_admin_pt_decide(p_request_id uuid, p_decision text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_decision NOT IN ('accepted', 'declined') THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_decision');
  END IF;

  UPDATE public.ot_pt_requests
  SET status = p_decision, decided_at = now()
  WHERE id = p_request_id AND status = 'requested';
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- 5) ot_get_link 확장: 최근 유효 PT 신청 1건 반환 (취소분 제외)
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
      -- confirmed(예약) + completed(출석 소진) 모두 반환: 화면이 '오티 끝' 안내를 출석 기준으로 판단
      WHERE b.link_id = v_link.id AND b.status IN ('confirmed', 'completed')
    ), '[]'::json),
    'pt_request', (
      SELECT json_build_object('id', r.id, 'date', r.requested_date, 'time', r.requested_time, 'status', r.status)
      FROM public.ot_pt_requests r
      WHERE r.link_id = v_link.id AND r.status <> 'cancelled'
      ORDER BY r.created_at DESC
      LIMIT 1
    )
  );
END;
$$;

-- PUBLIC 기본 실행권 회수 후 명시 grant
REVOKE ALL ON FUNCTION public.ot_request_pt(uuid, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ot_cancel_pt_request(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ot_admin_pt_decide(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ot_request_pt(uuid, date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ot_cancel_pt_request(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ot_admin_pt_decide(uuid, text) TO authenticated;
