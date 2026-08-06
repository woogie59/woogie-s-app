-- 회원 공지 팝업: QA(테스트용1) 제한 해제 → 전체 회원 노출

CREATE OR REPLACE FUNCTION public.get_active_member_announcement()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.id, a.title, a.body, a.published_at
  INTO v_row
  FROM public.member_announcements a
  LEFT JOIN public.member_announcement_states s
    ON s.announcement_id = a.id AND s.user_id = v_uid
  WHERE a.is_published = true
    AND s.dismissed_at IS NULL
    AND (s.snooze_until IS NULL OR s.snooze_until <= now())
  ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'title', v_row.title,
    'body', v_row.body,
    'published_at', v_row.published_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_member_announcement(
  p_announcement_id uuid,
  p_dismiss_permanent boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_announcement_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_id');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.member_announcements
    WHERE id = p_announcement_id AND is_published = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.member_announcement_states (user_id, announcement_id, snooze_until, dismissed_at, updated_at)
  VALUES (
    v_uid,
    p_announcement_id,
    CASE WHEN p_dismiss_permanent THEN NULL ELSE public.kst_next_midnight_utc() END,
    CASE WHEN p_dismiss_permanent THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (user_id, announcement_id) DO UPDATE SET
    snooze_until = CASE
      WHEN p_dismiss_permanent THEN EXCLUDED.snooze_until
      ELSE public.kst_next_midnight_utc()
    END,
    dismissed_at = CASE
      WHEN p_dismiss_permanent THEN now()
      ELSE member_announcement_states.dismissed_at
    END,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

DROP FUNCTION IF EXISTS public.is_member_announcement_qa_user();
