-- Same member + KST date + class time must not create two COMPLETED attendance_logs.
-- Cause: QR/self `check_in_user` always INSERTed; admin complete then missed the row when
-- session_time_fixed was '18:00:00' vs normalized '18:00' (check_in_at 17:56 vs 18:00).

CREATE OR REPLACE FUNCTION public._normalize_booking_time(p_time text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN btrim(COALESCE(p_time, '')) ~ '^\d{1,2}:\d{2}'
    THEN lpad(split_part(substring(btrim(p_time) from '^\d{1,2}:\d{2}'), ':', 1), 2, '0')
      || ':'
      || split_part(substring(btrim(p_time) from '^\d{1,2}:\d{2}'), ':', 2)
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public._attendance_slot_time(p_session_time_fixed text, p_check_in_at timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    public._normalize_booking_time(p_session_time_fixed),
    to_char(p_check_in_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI')
  );
$$;

CREATE OR REPLACE FUNCTION public._find_completed_attendance_log(
  p_user_id uuid,
  p_date text,
  p_time_norm text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_date IS NULL OR p_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN NULL;
  END IF;
  v_start := (p_date::date AT TIME ZONE 'Asia/Seoul');
  v_end := v_start + interval '1 day' - interval '1 millisecond';

  SELECT al.id INTO v_id
  FROM public.attendance_logs al
  WHERE al.user_id = p_user_id
    AND al.check_in_at >= v_start
    AND al.check_in_at <= v_end
    AND upper(replace(btrim(COALESCE(al.status, '')), '-', '_')) NOT IN (
      'CANCELLED', 'CANCELED', 'VOID', 'INVALID', 'PENDING'
    )
    AND (
      p_time_norm IS NULL
      OR public._attendance_slot_time(al.session_time_fixed, al.check_in_at) = p_time_norm
    )
  ORDER BY al.check_in_at ASC, al.id ASC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- Collapse existing duplicates: keep earliest check-in, restore one session per extra row.
DO $$
DECLARE
  r record;
  i int;
  v_batch uuid;
  v_total int;
  v_used int;
  v_remaining int;
BEGIN
  FOR r IN
    SELECT
      user_id,
      slot_date,
      slot_time,
      array_agg(id ORDER BY check_in_at ASC, id ASC) AS ids
    FROM (
      SELECT
        id,
        user_id,
        check_in_at,
        (check_in_at AT TIME ZONE 'Asia/Seoul')::date AS slot_date,
        public._attendance_slot_time(session_time_fixed, check_in_at) AS slot_time
      FROM public.attendance_logs
      WHERE upper(replace(btrim(COALESCE(status, '')), '-', '_')) NOT IN (
        'CANCELLED', 'CANCELED', 'VOID', 'INVALID', 'PENDING'
      )
    ) s
    GROUP BY user_id, slot_date, slot_time
    HAVING count(*) > 1
  LOOP
    IF r.ids IS NULL OR array_length(r.ids, 1) IS NULL THEN
      CONTINUE;
    END IF;
    FOR i IN 2 .. array_length(r.ids, 1) LOOP
      DELETE FROM public.attendance_logs WHERE id = r.ids[i];

      SELECT id INTO v_batch
      FROM public.session_batches
      WHERE user_id = r.user_id
        AND remaining_count < total_count
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE;

      IF v_batch IS NOT NULL THEN
        UPDATE public.session_batches
        SET remaining_count = remaining_count + 1
        WHERE id = v_batch;
      END IF;
    END LOOP;

    SELECT COALESCE(SUM(total_count), 0)::int INTO v_total
    FROM public.session_batches
    WHERE user_id = r.user_id;

    SELECT COUNT(*)::int INTO v_used
    FROM public.attendance_logs al
    WHERE al.user_id = r.user_id
      AND (
        (al.status IS NULL OR btrim(al.status) = '')
        OR upper(replace(btrim(al.status), '-', '_')) = 'COMPLETED'
      )
      AND upper(replace(btrim(COALESCE(al.status, '')), '-', '_')) NOT IN (
        'CANCELLED', 'CANCELED', 'VOID', 'INVALID', 'PENDING'
      );

    IF v_total > 0 THEN
      v_remaining := GREATEST(0, v_total - v_used);
    ELSE
      SELECT COALESCE(remaining_sessions, 0) INTO v_remaining
      FROM public.profiles
      WHERE id = r.user_id;
    END IF;

    UPDATE public.profiles
    SET remaining_sessions = v_remaining
    WHERE id = r.user_id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_attendance_slot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_date text;
  v_time text;
BEGIN
  IF upper(replace(btrim(COALESCE(NEW.status, '')), '-', '_')) IN (
    'CANCELLED', 'CANCELED', 'VOID', 'INVALID', 'PENDING'
  ) THEN
    RETURN NEW;
  END IF;

  v_date := to_char(NEW.check_in_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD');
  v_time := public._attendance_slot_time(NEW.session_time_fixed, NEW.check_in_at);

  IF public._find_completed_attendance_log(NEW.user_id, v_date, v_time) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_DUPLICATE_ATTENDANCE_SLOT'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_attendance_slot ON public.attendance_logs;
CREATE TRIGGER trg_prevent_duplicate_attendance_slot
  BEFORE INSERT
  ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_attendance_slot();

CREATE OR REPLACE FUNCTION public.check_in_user(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price INT;
  v_kst TEXT;
  v_utc TEXT;
  booking_time TEXT;
  v_time_norm TEXT;
  v_booking_id UUID;
  v_existing UUID;
  v_total INT;
  v_used INT;
  v_scheduled INT;
  v_remaining_before INT;
  v_profile_remaining INT;
  new_sessions INT;
  v_batch_id UUID;
BEGIN
  v_kst := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD');
  v_utc := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD');

  SELECT b.time, b.id INTO booking_time, v_booking_id
  FROM public.bookings b
  WHERE b.user_id = user_uuid
    AND b.date IN (v_kst, v_utc)
    AND lower(replace(btrim(COALESCE(b.status, '')), '_', '-')) <> 'cancelled'
  ORDER BY b.created_at DESC NULLS LAST, b.id DESC
  LIMIT 1;

  IF booking_time IS NULL THEN
    RAISE EXCEPTION 'ERR_NO_BOOKING_TODAY';
  END IF;

  v_time_norm := public._normalize_booking_time(booking_time);

  PERFORM 1 FROM public.profiles WHERE id = user_uuid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_existing := public._find_completed_attendance_log(user_uuid, v_kst, v_time_norm);
  IF v_existing IS NULL AND v_utc IS DISTINCT FROM v_kst THEN
    v_existing := public._find_completed_attendance_log(user_uuid, v_utc, v_time_norm);
  END IF;

  IF v_existing IS NOT NULL THEN
    IF v_booking_id IS NOT NULL THEN
      UPDATE public.bookings
      SET status = 'completed'
      WHERE id = v_booking_id
        AND lower(replace(btrim(COALESCE(status, '')), '_', '-')) <> 'completed';
    END IF;

    SELECT COALESCE(SUM(total_count), 0)::INT INTO v_total
    FROM public.session_batches WHERE user_id = user_uuid;

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

    IF v_total > 0 THEN
      new_sessions := GREATEST(0, v_total - v_used);
    ELSE
      SELECT COALESCE(remaining_sessions, 0) INTO new_sessions FROM public.profiles WHERE id = user_uuid;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'already_logged', true,
      'remaining', new_sessions,
      'session_time_fixed', v_time_norm
    );
  END IF;

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

  IF COALESCE(v_remaining_before, 0) <= 0 THEN
    RAISE WARNING
      'check_in_user NO_SESSION: total=% used=% rem=% sched_kst+=% prof=% kst=%',
      v_total, v_used, v_remaining_before, v_scheduled, COALESCE(v_profile_remaining, -1), v_kst;
    RAISE EXCEPTION 'No remaining sessions (사용 가능한 세션 티켓이 없습니다)';
  END IF;

  SELECT id, COALESCE(price_per_session, 0) INTO v_batch_id, v_price
  FROM public.session_batches
  WHERE user_id = user_uuid AND remaining_count > 0
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_batch_id IS NOT NULL THEN
    UPDATE public.session_batches
    SET remaining_count = remaining_count - 1
    WHERE id = v_batch_id;
  ELSE
    SELECT COALESCE(price_per_session, 0) INTO v_price FROM public.profiles WHERE id = user_uuid;
  END IF;

  new_sessions := v_remaining_before - 1;

  UPDATE public.profiles
  SET remaining_sessions = new_sessions
  WHERE id = user_uuid;

  INSERT INTO public.attendance_logs (user_id, session_price_snapshot, session_time_fixed, status)
  VALUES (user_uuid, v_price, v_time_norm, 'COMPLETED');

  IF v_booking_id IS NOT NULL THEN
    UPDATE public.bookings
    SET status = 'completed'
    WHERE id = v_booking_id
      AND lower(replace(btrim(COALESCE(status, '')), '_', '-')) <> 'completed';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_logged', false,
    'remaining', new_sessions,
    'price_logged', v_price,
    'session_time_fixed', v_time_norm
  );
END;
$$;

COMMENT ON FUNCTION public.check_in_user(UUID) IS
  'QR/self check-in. Idempotent per member+KST date+class time. FIFO batch unit price.';

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

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'user_not_found');
  END IF;

  v_date := left(btrim(v_booking.date::text), 10);
  IF v_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'invalid_booking_date');
  END IF;

  v_time_norm := public._normalize_booking_time(v_booking.time);

  v_existing_log_id := public._find_completed_attendance_log(v_user_id, v_date, v_time_norm);

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

  SELECT id, COALESCE(price_per_session, 0) INTO v_batch_id, v_price
  FROM public.session_batches
  WHERE user_id = v_user_id AND remaining_count > 0
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_batch_id IS NOT NULL THEN
    UPDATE public.session_batches
    SET remaining_count = remaining_count - 1
    WHERE id = v_batch_id;
  ELSE
    SELECT COALESCE(price_per_session, 0) INTO v_price FROM public.profiles WHERE id = v_user_id;
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
  WHEN unique_violation THEN
    UPDATE public.bookings
    SET status = 'completed'
    WHERE id = p_booking_id
      AND lower(replace(btrim(COALESCE(status, '')), '_', '-')) <> 'completed';
    RETURN jsonb_build_object(
      'ok', true,
      'success', true,
      'booking_id', p_booking_id,
      'already_logged', true
    );
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.admin_update_session_status(uuid, text) IS
  'Admin-only: complete booking + one attendance log per member/date/time slot.';
