-- 관리자 수업 추가(RPC) · bookings RLS · 자동완료 과다 차감 방지

-- ---------------------------------------------------------------------------
-- 1) Admin bookings RLS (direct insert fallback)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can create any booking" ON public.bookings;
CREATE POLICY "Admins can create any booking"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
CREATE POLICY "Admins can view all bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update any booking" ON public.bookings;
CREATE POLICY "Admins can update any booking"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 2) admin_create_booking — 예약만 생성, 세션(수강권) 차감 없음
-- ---------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION public.admin_create_booking(
  p_user_id uuid,
  p_date text,
  p_time text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date text;
  v_time text;
  v_booking_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_user');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role IS DISTINCT FROM 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member_not_found');
  END IF;

  v_date := left(btrim(COALESCE(p_date, '')), 10);
  IF v_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_date');
  END IF;

  v_time := public._normalize_booking_time(p_time);
  IF v_time IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_time');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE left(btrim(b.date::text), 10) = v_date
      AND public._normalize_booking_time(b.time) = v_time
      AND lower(replace(btrim(COALESCE(b.status, '')), '_', '-')) <> 'cancelled'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slot_taken');
  END IF;

  INSERT INTO public.bookings (user_id, date, time, status)
  VALUES (p_user_id, v_date, v_time, 'confirmed')
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'user_id', p_user_id,
    'date', v_date,
    'time', v_time
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slot_taken');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.admin_create_booking(uuid, text, text) IS
  '관리자 전용 예약 생성. 수강권/출석 로그는 건드리지 않음(완료·출석 시에만 차감).';

GRANT EXECUTE ON FUNCTION public.admin_create_booking(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) auto_complete — 최근 7일 이내 종료된 수업만 자동 완료 (백로그 일괄 차감 방지)
-- ---------------------------------------------------------------------------
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
      AND public._booking_start_kst(b.date::text, b.time) + interval '1 hour' >= now() - interval '7 days'
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

COMMENT ON FUNCTION public.auto_complete_due_bookings() IS
  '예약 시작(KST)+1h 경과 후 7일 이내 미완료 booking만 admin_update_session_status로 완료.';
