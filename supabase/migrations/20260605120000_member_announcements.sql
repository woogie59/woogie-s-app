-- 회원 공지 팝업 (MVP: QA 프로필 '테스트용1'만 RPC 노출)

CREATE TABLE IF NOT EXISTS public.member_announcements (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  body          text        NOT NULL,
  is_published  boolean     NOT NULL DEFAULT false,
  published_at  timestamptz,
  created_by    uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_announcements_published_idx
  ON public.member_announcements (is_published, published_at DESC)
  WHERE is_published = true;

CREATE TABLE IF NOT EXISTS public.member_announcement_states (
  user_id           uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  announcement_id   uuid        NOT NULL REFERENCES public.member_announcements (id) ON DELETE CASCADE,
  snooze_until      timestamptz,
  dismissed_at      timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS member_announcement_states_user_idx
  ON public.member_announcement_states (user_id);

ALTER TABLE public.member_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_announcement_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_announcements_admin_all"
  ON public.member_announcements
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "member_announcement_states_select_own"
  ON public.member_announcement_states
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_announcements TO authenticated;
GRANT SELECT ON public.member_announcement_states TO authenticated;

CREATE OR REPLACE FUNCTION public.is_member_announcement_qa_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    trim(p.name) = '테스트용1',
    false
  )
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.kst_next_midnight_utc()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT (
    ((now() AT TIME ZONE 'Asia/Seoul')::date + interval '1 day')::timestamp
    AT TIME ZONE 'Asia/Seoul'
  );
$$;

/** Latest published announcement visible to current member (QA-gated). */
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

  IF NOT public.is_member_announcement_qa_user() THEN
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

/** Confirm popup: permanent dismiss or snooze until next KST midnight. */
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

  IF NOT public.is_member_announcement_qa_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'qa_only');
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

GRANT EXECUTE ON FUNCTION public.is_member_announcement_qa_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_member_announcement() TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_member_announcement(uuid, boolean) TO authenticated;
