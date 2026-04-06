-- QR 체크인: 오늘 날짜 예약이 있어야 출석 처리. 동일일 다중 예약 시 가장 최근(created_at) 행 사용.
-- 삭제된 행은 존재하지 않으므로 자동 제외.

ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS session_time_fixed TEXT;

DROP FUNCTION IF EXISTS public.check_in_user(uuid);

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
  v_today TEXT;
  booking_time TEXT;
BEGIN
  v_today := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD');

  SELECT b.time INTO booking_time
  FROM public.bookings b
  WHERE b.user_id = user_uuid
    AND b.date = v_today
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
  'Requires a booking for today (KST); uses latest booking by created_at. Writes session_time_fixed from that booking.';

GRANT EXECUTE ON FUNCTION public.check_in_user(UUID) TO authenticated;
