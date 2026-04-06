-- check_in_user: 오늘 예약 매칭 시 KST·UTC 달력 날짜 모두 허용 (클라이언트 로컬 vs 서버 TZ 불일치 완화)

CREATE OR REPLACE FUNCTION public.check_in_user(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_sessions INT;
  current_price INT;
  new_sessions INT;
  v_kst TEXT;
  v_utc TEXT;
  booking_time TEXT;
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

  SELECT remaining_sessions, COALESCE(price_per_session, 0)
  INTO current_sessions, current_price
  FROM public.profiles
  WHERE id = user_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF current_sessions IS NULL OR current_sessions < 1 THEN
    RAISE EXCEPTION 'No remaining sessions';
  END IF;

  new_sessions := current_sessions - 1;

  UPDATE public.profiles
  SET remaining_sessions = new_sessions
  WHERE id = user_uuid;

  INSERT INTO public.attendance_logs (user_id, session_price_snapshot, session_time_fixed)
  VALUES (user_uuid, current_price, booking_time);

  RETURN jsonb_build_object(
    'success', true,
    'remaining', new_sessions,
    'price_logged', current_price,
    'session_time_fixed', booking_time
  );
END;
$$;

COMMENT ON FUNCTION public.check_in_user(UUID) IS
  'Requires a booking for today (KST or UTC calendar date); latest by created_at. session_time_fixed from that row.';

GRANT EXECUTE ON FUNCTION public.check_in_user(UUID) TO authenticated;
