-- 예약 시작 + 1시간 경과 시 자동 완료 · 완료된 수업도 관리자 취소(세션 복원)

CREATE OR REPLACE FUNCTION public._booking_start_kst(p_date text, p_time text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN left(btrim(COALESCE(p_date, '')), 10) ~ '^\d{4}-\d{2}-\d{2}$'
      AND btrim(COALESCE(p_time, '')) ~ '^\d{1,2}:\d{2}'
    THEN (
      (left(btrim(p_date), 10) || ' ' ||
       lpad(split_part(substring(btrim(p_time) from '^\d{1,2}:\d{2}'), ':', 1), 2, '0') || ':' ||
       split_part(substring(btrim(p_time) from '^\d{1,2}:\d{2}'), ':', 2) || ':00')::timestamp
      AT TIME ZONE 'Asia/Seoul'
    )
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.auto_complete_due_bookings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_result jsonb;
  v_completed int := 0;
  v_skipped int := 0;
BEGIN
  FOR v_row IN
    SELECT b.id
    FROM public.bookings b
    WHERE lower(replace(btrim(COALESCE(b.status, '')), '_', '-')) NOT IN ('completed', 'cancelled')
      AND public._booking_start_kst(b.date::text, b.time) IS NOT NULL
      AND public._booking_start_kst(b.date::text, b.time) + interval '1 hour' <= now()
    ORDER BY b.date ASC, b.time ASC
  LOOP
    BEGIN
      v_result := public.admin_update_session_status(v_row.id, 'completed');
      IF COALESCE((v_result->>'ok')::boolean, false)
        OR COALESCE((v_result->>'success')::boolean, false) THEN
        v_completed := v_completed + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'completed_count', v_completed, 'skipped_count', v_skipped);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(p_booking_id uuid)
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
  v_existing_log_id uuid;
  v_batch_id uuid;
  v_total int;
  v_used int;
  v_new_remaining int := NULL;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_booking_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_booking');
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  v_user_id := v_booking.user_id;
  v_date := left(btrim(v_booking.date::text), 10);

  v_time_norm := btrim(COALESCE(v_booking.time, ''));
  IF v_time_norm ~ '^\d{1,2}:\d{2}' THEN
    v_time_norm := lpad(split_part(substring(v_time_norm from '^\d{1,2}:\d{2}'), ':', 1), 2, '0')
      || ':'
      || split_part(substring(v_time_norm from '^\d{1,2}:\d{2}'), ':', 2);
  ELSE
    v_time_norm := NULL;
  END IF;

  IF v_user_id IS NOT NULL AND v_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
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

    IF v_existing_log_id IS NOT NULL THEN
      DELETE FROM public.attendance_logs WHERE id = v_existing_log_id;

      SELECT id INTO v_batch_id
      FROM public.session_batches
      WHERE user_id = v_user_id
        AND remaining_count < total_count
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE;

      IF v_batch_id IS NOT NULL THEN
        UPDATE public.session_batches
        SET remaining_count = remaining_count + 1
        WHERE id = v_batch_id;
      END IF;

      SELECT COALESCE(SUM(total_count), 0)::int INTO v_total
      FROM public.session_batches
      WHERE user_id = v_user_id;

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
        SELECT COALESCE(remaining_sessions, 0) + 1 INTO v_new_remaining
        FROM public.profiles
        WHERE id = v_user_id;
      END IF;

      UPDATE public.profiles
      SET remaining_sessions = v_new_remaining
      WHERE id = v_user_id;
    END IF;
  END IF;

  DELETE FROM public.bookings WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'remaining', v_new_remaining,
    'had_attendance_log', v_existing_log_id IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION public.auto_complete_due_bookings() IS
  '예약 시작(KST) + 1시간 경과 후 미완료 booking을 admin_update_session_status로 일괄 완료.';
COMMENT ON FUNCTION public.admin_cancel_booking(uuid) IS
  '관리자 예약 취소: 출석 로그 삭제·세션 복원 후 booking 삭제.';

GRANT EXECUTE ON FUNCTION public.auto_complete_due_bookings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_booking(uuid) TO authenticated;
