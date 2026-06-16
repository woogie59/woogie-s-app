-- Admin schedule "수업 완료": atomically mark booking completed + consume 1 session (attendance_logs COMPLETED).
-- UI 잔여 = sum(session_batches.total_count) − count(attendance_logs COMPLETED).

-- 기존 DB에 다른 반환 타입으로 정의된 함수가 있으면 CREATE OR REPLACE가 실패함
DROP FUNCTION IF EXISTS public.admin_update_session_status(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_update_session_status(
  p_booking_id uuid,
  p_new_status text DEFAULT 'completed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_user_id uuid;
  v_time_norm text;
  v_date text;
  v_check_in_start timestamptz;
  v_check_in_end timestamptz;
  v_check_in_at timestamptz;
  v_existing_log_id uuid;
  v_total int;
  v_used int;
  v_remaining_before int;
  v_profile_remaining int;
  v_new_remaining int;
  v_price int;
  v_batch_id uuid;
  v_status_norm text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'forbidden');
  END IF;

  IF p_booking_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'invalid_booking');
  END IF;

  v_status_norm := lower(replace(btrim(COALESCE(p_new_status, '')), '_', '-'));
  IF v_status_norm <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'unsupported_status');
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'booking_not_found');
  END IF;

  v_user_id := v_booking.user_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'missing_user');
  END IF;

  v_date := left(btrim(v_booking.date::text), 10);
  IF v_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'invalid_booking_date');
  END IF;

  v_time_norm := btrim(COALESCE(v_booking.time, ''));
  IF v_time_norm ~ '^\d{1,2}:\d{2}' THEN
    v_time_norm := lpad(split_part(substring(v_time_norm from '^\d{1,2}:\d{2}'), ':', 1), 2, '0')
      || ':'
      || split_part(substring(v_time_norm from '^\d{1,2}:\d{2}'), ':', 2);
  ELSE
    v_time_norm := NULL;
  END IF;

  v_check_in_start := (v_date::date AT TIME ZONE 'Asia/Seoul');
  v_check_in_end := v_check_in_start + interval '1 day' - interval '1 millisecond';

  SELECT al.id INTO v_existing_log_id
  FROM public.attendance_logs al
  WHERE al.user_id = v_user_id
    AND al.check_in_at >= v_check_in_start
    AND al.check_in_at <= v_check_in_end
    AND (
      v_time_norm IS NULL
      OR btrim(COALESCE(al.session_time_fixed, '')) = v_time_norm
    )
    AND upper(replace(btrim(COALESCE(al.status, '')), '-', '_')) NOT IN (
      'CANCELLED', 'CANCELED', 'VOID', 'INVALID'
    )
  ORDER BY al.check_in_at DESC
  LIMIT 1;

  -- Idempotent: already logged for this slot — only ensure booking status
  IF v_existing_log_id IS NOT NULL THEN
    UPDATE public.bookings
    SET status = 'completed'
    WHERE id = p_booking_id
      AND lower(replace(btrim(COALESCE(status, '')), '_', '-')) <> 'completed';

    SELECT COALESCE(SUM(total_count), 0)::int INTO v_total
    FROM public.session_batches WHERE user_id = v_user_id;

    SELECT COUNT(*)::int INTO v_used
    FROM public.attendance_logs al
    WHERE al.user_id = v_user_id
      AND (
        (al.status IS NULL OR btrim(al.status) = '')
        OR upper(replace(btrim(al.status), '-', '_')) = 'COMPLETED'
      )
      AND upper(replace(btrim(COALESCE(al.status, '')), '-', '_')) NOT IN (
        'CANCELLED', 'CANCELED', 'VOID', 'INVALID', 'PENDING'
      );

    IF v_total > 0 THEN
      v_new_remaining := GREATEST(0, v_total - v_used);
    ELSE
      SELECT COALESCE(remaining_sessions, 0) INTO v_new_remaining FROM public.profiles WHERE id = v_user_id;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'success', true,
      'user_id', v_user_id,
      'booking_id', p_booking_id,
      'remaining', v_new_remaining,
      'already_logged', true
    );
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'user_not_found');
  END IF;

  SELECT COALESCE(price_per_session, 0) INTO v_price FROM public.profiles WHERE id = v_user_id;

  SELECT COALESCE(SUM(total_count), 0)::int INTO v_total
  FROM public.session_batches WHERE user_id = v_user_id;

  SELECT COUNT(*)::int INTO v_used
  FROM public.attendance_logs al
  WHERE al.user_id = v_user_id
    AND (
      (al.status IS NULL OR btrim(al.status) = '')
      OR upper(replace(btrim(al.status), '-', '_')) = 'COMPLETED'
    )
    AND upper(replace(btrim(COALESCE(al.status, '')), '-', '_')) NOT IN (
      'CANCELLED', 'CANCELED', 'VOID', 'INVALID', 'PENDING'
    );

  IF v_total > 0 THEN
    v_remaining_before := GREATEST(0, v_total - v_used);
  ELSE
    SELECT COALESCE(remaining_sessions, 0) INTO v_profile_remaining FROM public.profiles WHERE id = v_user_id;
    v_remaining_before := v_profile_remaining;
  END IF;

  IF COALESCE(v_remaining_before, 0) <= 0 THEN
    RAISE EXCEPTION 'No remaining sessions (사용 가능한 세션 티켓이 없습니다)';
  END IF;

  -- FIFO pack decrement (keeps batch rows in sync)
  SELECT id INTO v_batch_id
  FROM public.session_batches
  WHERE user_id = v_user_id AND remaining_count > 0
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_batch_id IS NOT NULL THEN
    UPDATE public.session_batches
    SET remaining_count = remaining_count - 1
    WHERE id = v_batch_id;
  END IF;

  v_new_remaining := v_remaining_before - 1;

  UPDATE public.profiles
  SET remaining_sessions = v_new_remaining
  WHERE id = v_user_id;

  IF v_time_norm IS NOT NULL THEN
    v_check_in_at := ((v_date || ' ' || v_time_norm || ':00')::timestamp AT TIME ZONE 'Asia/Seoul');
  ELSE
    v_check_in_at := (v_date::date AT TIME ZONE 'Asia/Seoul') + interval '12 hours';
  END IF;

  INSERT INTO public.attendance_logs (
    user_id,
    check_in_at,
    session_price_snapshot,
    session_time_fixed,
    status
  )
  VALUES (
    v_user_id,
    v_check_in_at,
    v_price,
    v_time_norm,
    'COMPLETED'
  );

  UPDATE public.bookings
  SET status = 'completed'
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'user_id', v_user_id,
    'booking_id', p_booking_id,
    'remaining', v_new_remaining,
    'already_logged', false
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.admin_update_session_status(uuid, text) IS
  'Admin-only: complete a booking, insert attendance_logs COMPLETED (1 session consumed), sync profiles/batches.';

GRANT EXECUTE ON FUNCTION public.admin_update_session_status(uuid, text) TO authenticated;
