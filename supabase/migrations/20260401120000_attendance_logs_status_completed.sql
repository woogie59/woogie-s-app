-- 출석 로그 소진 집계: status = COMPLETED 인 행만 잔여 계산에 사용 (앱 단일 기준).
-- 기존 행은 모두 완료 출석으로 간주.

ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.attendance_logs
SET status = 'COMPLETED'
WHERE status IS NULL OR trim(status) = '';

ALTER TABLE public.attendance_logs
  ALTER COLUMN status SET DEFAULT 'COMPLETED';

COMMENT ON COLUMN public.attendance_logs.status IS
  'COMPLETED = 세션 1회 소진. 취소/무효는 CANCELLED 등으로 구분.';

-- QR 체크인 RPC: INSERT 시 status 명시
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
