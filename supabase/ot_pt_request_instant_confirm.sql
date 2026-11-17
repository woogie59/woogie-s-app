-- 피티 등록 신청 = 신청 즉시 예약 확정 + 즉시 시간 닫힘 (2026-11-17 20:51 사용자 지시)
-- "신청 즉시 예약 확정으로 바꾸고, 센터 검토 후 안내한다는 메세지를 '피티등록이 신청되었습니다.'로
--  바꿉시다. 그리고 신청 즉시 닫히게 하시죠"
-- 설계: 신청 INSERT와 같은 트랜잭션에서 trainer_blocked_slots(kind='ot', label='PT')로 자리를 막는다.
-- 기존 OT와 같은 경로로 회원 예약이 즉시 닫히고 ot_calendar_enqueue 트리거가 구글캘린더에 반영.
-- public.bookings(정규 예약)는 만들지 않는다 — OT 링크 회원은 앱 계정이 없기 때문.
-- 기존 신청(신정인 11/23 등)은 소급 변경하지 않는다 (Future INSERT만 즉시 확정).
BEGIN;

-- 1) 신청 ↔ 블록 연결
ALTER TABLE public.ot_pt_requests
  ADD COLUMN IF NOT EXISTS block_id uuid REFERENCES public.trainer_blocked_slots(id) ON DELETE SET NULL;

-- 2) 신청 즉시 확정 + 즉시 차단. 검증(날짜/시간/횟수/중복/충돌)은 기존과 동일.
--    status='accepted'(확정)으로 저장. 결정적 잠금: (block_date, block_time) 유니크 인덱스가
--    동시 신청을 원자적으로 거부 → unique_violation은 slot_taken.
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
  v_block_id uuid;
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

  -- 진행 중이거나 확정된 신청이 있으면 추가 신청 불가
  IF EXISTS (SELECT 1 FROM public.ot_pt_requests WHERE link_id = v_link.id AND status = 'requested') THEN
    RETURN json_build_object('ok', false, 'reason', 'already_requested');
  END IF;
  IF EXISTS (SELECT 1 FROM public.ot_pt_requests WHERE link_id = v_link.id AND status = 'accepted') THEN
    RETURN json_build_object('ok', false, 'reason', 'already_accepted');
  END IF;

  -- 희망 일시 충돌 검사 (정규예약·블록·확정 OT — ot_book과 동일 기준)
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

  -- 이름은 전체 조회 가능한 블록에 쓰지 않는다(기존 OT 최소 데이터 원칙). gcal 이름은
  -- ot_pt_requests → ot_links 경로로 프라이빗 조회한다 (google-calendar-sync-v2 확장분).
  -- 블록 유니크 충돌(동시 점유)은 slot_taken, 신청 유니크 충돌(중복 신청)은 already_requested로 구분.
  BEGIN
    INSERT INTO public.trainer_blocked_slots (block_date, block_time, label, kind)
    VALUES (p_date, v_time, 'PT', 'ot')
    RETURNING id INTO v_block_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN json_build_object('ok', false, 'reason', 'slot_taken');
  END;

  INSERT INTO public.ot_pt_requests (link_id, requested_date, requested_time, status, decided_at, block_id)
  VALUES (v_link.id, p_date, v_time, 'accepted', now(), v_block_id)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'request_id', v_id, 'date', p_date, 'time', v_time);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'reason', 'already_requested');
END;
$$;

-- 3) 회원 신청 취소: 연결된 해당 블록만 해제 (기존 OT/타 예약 불변).
--    블록 DELETE는 ot_calendar_enqueue가 감지해 구글캘린더 삭제 동기화로 이어진다.
CREATE OR REPLACE FUNCTION public.ot_cancel_pt_request(p_token uuid, p_request_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.ot_links%ROWTYPE;
  v_block uuid;
BEGIN
  SELECT * INTO v_link FROM public.ot_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  UPDATE public.ot_pt_requests
  SET status = 'cancelled', decided_at = now()
  WHERE id = p_request_id AND link_id = v_link.id AND status = 'requested'
  RETURNING block_id INTO v_block;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_block IS NOT NULL THEN
    DELETE FROM public.trainer_blocked_slots WHERE id = v_block;
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- 4) 관리자 승인/거절 (기존 'requested' 유산 신청용 — 신규는 신청 즉시 확정됨)
--    승인: 블록이 이미 연결돼 있으면 멱등 성공. 없으면 충돌 검사 후 생성.
--    거절: 연결된 해당 블록만 해제.
CREATE OR REPLACE FUNCTION public.ot_admin_pt_decide(p_request_id uuid, p_decision text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req public.ot_pt_requests%ROWTYPE;
  v_block_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_decision NOT IN ('accepted', 'declined') THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_decision');
  END IF;

  SELECT * INTO v_req FROM public.ot_pt_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.status <> 'requested' THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF p_decision = 'accepted' THEN
    IF v_req.block_id IS NOT NULL THEN
      UPDATE public.ot_pt_requests SET status = 'accepted', decided_at = now() WHERE id = p_request_id;
      RETURN json_build_object('ok', true);
    END IF;
    IF EXISTS (SELECT 1 FROM public.bookings
               WHERE left(btrim(date), 10) = v_req.requested_date::text
                 AND public._normalize_booking_time(time) = v_req.requested_time
                 AND COALESCE(status, '') <> 'cancelled')
       OR EXISTS (SELECT 1 FROM public.trainer_blocked_slots
                  WHERE block_date = v_req.requested_date AND block_time = v_req.requested_time)
       OR EXISTS (SELECT 1 FROM public.ot_bookings
                  WHERE date = v_req.requested_date AND time = v_req.requested_time AND status = 'confirmed') THEN
      RETURN json_build_object('ok', false, 'reason', 'slot_taken');
    END IF;
    INSERT INTO public.trainer_blocked_slots (block_date, block_time, label, kind)
    VALUES (v_req.requested_date, v_req.requested_time, 'PT', 'ot')
    RETURNING id INTO v_block_id;
    UPDATE public.ot_pt_requests SET status = 'accepted', decided_at = now(), block_id = v_block_id WHERE id = p_request_id;
    RETURN json_build_object('ok', true);
  END IF;

  -- declined: 연결된 해당 블록만 해제
  UPDATE public.ot_pt_requests SET status = 'declined', decided_at = now() WHERE id = p_request_id;
  IF v_req.block_id IS NOT NULL THEN
    DELETE FROM public.trainer_blocked_slots WHERE id = v_req.block_id;
  END IF;
  RETURN json_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'reason', 'slot_taken');
END;
$$;

-- 5) 알림 트리거: 즉시 확정(accepted)으로 들어오는 신규 신청에도 관리자 푸시가 가도록 확장
CREATE OR REPLACE FUNCTION public.notify_ot_pt_request_admin_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IN ('requested','accepted') THEN
  INSERT INTO public.ot_pt_request_notify_jobs(request_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  PERFORM public.ot_pt_notify_fire(NEW.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_ot_pt_request_admin_push() FROM PUBLIC,anon,authenticated;

COMMIT;
