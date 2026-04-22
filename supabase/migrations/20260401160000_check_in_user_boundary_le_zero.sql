-- check_in_user: 잔여 검증을 명시적으로 "0 이하일 때만" 거절(정수 1회는 항상 통과).
-- session_batches+attendance 집계 일치, 레거시는 profiles.remaining_sessions.
-- P0001(raise_exception) 이전 경계: COALESCE(v_remaining_before,0) <= 0

CREATE OR REPLACE FUNCTION public.check_in_user(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_price INT;
  v_kst TEXT;
  v_utc TEXT;
  booking_time TEXT;
  v_total INT;
  v_used INT;
  v_scheduled INT;
  v_remaining_before INT;
  v_profile_remaining INT;
  new_sessions INT;
BEGIN
  v_kst := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD');
  v_utc := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD');

  SELECT b.time INTO booking_time
  FROM public.bookings b
  WHERE b.user_id = user_uuid
    AND b.date IN (v_kst, v_utc)
  ORDER BY b.created_at DESC NULLS LAST, b.id DESC
  LIMIT 1;

  IF booking_time IS NULL THEN
    RAISE EXCEPTION 'ERR_NO_BOOKING_TODAY';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = user_uuid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT COALESCE(price_per_session, 0) INTO current_price
  FROM public.profiles WHERE id = user_uuid;

  SELECT COALESCE(SUM(total_count), 0)::INT INTO v_total
  FROM public.session_batches
  WHERE user_id = user_uuid;

  SELECT COUNT(*)::INT INTO v_used
  FROM public.attendance_logs al
  WHERE al.user_id = user_uuid
    AND (
      (al.status IS NULL OR btrim(al.status) = '')
      OR upper(replace(btrim(al.status), '-', '_')) = 'COMPLETED'
    )
    AND upper(replace(btrim(COALESCE(al.status, '')), '-', '_')) NOT IN (
      'CANCELLED', 'CANCELED', 'VOID', 'INVALID', 'PENDING'
    );

  SELECT COUNT(*)::INT INTO v_scheduled
  FROM public.bookings b
  WHERE b.user_id = user_uuid
    AND (b.status IS NULL OR lower(replace(btrim(b.status), '_', '-')) <> 'cancelled')
    AND left(btrim(b.date::text), 10) >= v_kst;

  v_profile_remaining := NULL;
  IF v_total > 0 THEN
    v_remaining_before := GREATEST(0, v_total - v_used);
  ELSE
    SELECT COALESCE(remaining_sessions, 0) INTO v_profile_remaining FROM public.profiles WHERE id = user_uuid;
    v_remaining_before := v_profile_remaining;
  END IF;

  -- 1회 남은 경우: v_remaining_before = 1 → 아래 조건 false → 통과 후 INSERT·차감
  IF COALESCE(v_remaining_before, 0) <= 0 THEN
    RAISE WARNING
      'check_in_user NO_SESSION: total=% used=% rem=% sched_kst+=% prof=% kst=%',
      v_total, v_used, v_remaining_before, v_scheduled, COALESCE(v_profile_remaining, -1), v_kst;
    RAISE EXCEPTION 'No remaining sessions (사용 가능한 세션 티켓이 없습니다)';
  END IF;

  new_sessions := v_remaining_before - 1;

  UPDATE public.profiles
  SET remaining_sessions = new_sessions
  WHERE id = user_uuid;

  INSERT INTO public.attendance_logs (user_id, session_price_snapshot, session_time_fixed, status)
  VALUES (user_uuid, current_price, booking_time, 'COMPLETED');

  RETURN jsonb_build_object(
    'success', true,
    'remaining', new_sessions,
    'price_logged', current_price,
    'session_time_fixed', booking_time
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_user(UUID) TO authenticated;

COMMENT ON FUNCTION public.check_in_user(UUID) IS
  'QR 출석. 잔여: max(0, sum(session_batches.total_count)−완료 출석) 또는 batch 없을 때 profiles.remaining_sessions.';
