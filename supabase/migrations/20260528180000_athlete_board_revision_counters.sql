-- Per-section revision counters: precise NEW badges (immune to 'all' bump / null seen_at).
-- growth save → growth_revision++ only | title grant → titles_revision++ only

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS athlete_growth_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS athlete_growth_seen_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS athlete_titles_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS athlete_titles_seen_revision bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.athlete_growth_revision IS 'Increments on admin growth/level/comment save.';
COMMENT ON COLUMN public.profiles.athlete_growth_seen_revision IS 'Member opened 성장기록; NEW when growth_revision > this.';
COMMENT ON COLUMN public.profiles.athlete_titles_revision IS 'Increments on admin title grant/unlock.';
COMMENT ON COLUMN public.profiles.athlete_titles_seen_revision IS 'Member opened 칭호 목록; NEW when titles_revision > this.';

-- ── Section-specific bump (no p_section=all) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.bump_athlete_growth_board(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  UPDATE public.profiles
  SET
    athlete_board_updated_at = now(),
    athlete_growth_updated_at = now(),
    athlete_growth_revision = COALESCE(athlete_growth_revision, 0) + 1
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_athlete_titles_board(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  UPDATE public.profiles
  SET
    athlete_board_updated_at = now(),
    athlete_titles_updated_at = now(),
    athlete_titles_revision = COALESCE(athlete_titles_revision, 0) + 1
  WHERE id = p_user_id;
END;
$$;

-- Legacy wrapper: map section explicitly; reject accidental 'all' from old callers.
CREATE OR REPLACE FUNCTION public.bump_athlete_board_updated(
  p_user_id uuid,
  p_section text DEFAULT 'growth'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sec text := lower(trim(coalesce(p_section, 'growth')));
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF v_sec IN ('growth', 'level') THEN
    PERFORM public.bump_athlete_growth_board(p_user_id);
  ELSIF v_sec IN ('titles', 'title') THEN
    PERFORM public.bump_athlete_titles_board(p_user_id);
  ELSIF v_sec = 'all' THEN
    RAISE WARNING 'bump_athlete_board_updated(all) ignored — use growth or titles';
  ELSE
    PERFORM public.bump_athlete_growth_board(p_user_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_athlete_growth_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_athlete_titles_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_athlete_board_updated(uuid, text) TO authenticated;

-- ── Mark seen: sync revision counters ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_athlete_growth_seen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev bigint;
BEGIN
  UPDATE public.profiles
  SET
    athlete_growth_seen_at = now(),
    athlete_growth_seen_revision = COALESCE(athlete_growth_revision, 0)
  WHERE id = auth.uid()
  RETURNING athlete_growth_revision INTO v_rev;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'seen_revision', COALESCE(v_rev, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_athlete_titles_seen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev bigint;
BEGIN
  UPDATE public.profiles
  SET
    athlete_titles_seen_at = now(),
    athlete_titles_seen_revision = COALESCE(athlete_titles_revision, 0)
  WHERE id = auth.uid()
  RETURNING athlete_titles_revision INTO v_rev;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'seen_revision', COALESCE(v_rev, 0));
END;
$$;

-- ── Triggers: call section-specific bumpers only ─────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_bump_athlete_growth_from_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level_changed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.bump_athlete_growth_board(NEW.user_id);
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'growth_records' AND column_name = 'achieved_level'
  ) THEN
    v_level_changed := OLD.achieved_level IS DISTINCT FROM NEW.achieved_level;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'growth_records' AND column_name = 'new_level'
  ) THEN
    v_level_changed := OLD.new_level IS DISTINCT FROM NEW.new_level;
  END IF;

  IF v_level_changed
     OR OLD.standard_comment IS DISTINCT FROM NEW.standard_comment
     OR OLD.custom_comment IS DISTINCT FROM NEW.custom_comment THEN
    PERFORM public.bump_athlete_growth_board(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_bump_athlete_titles_from_member_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.bump_athlete_titles_board(NEW.user_id);
    RETURN NEW;
  END IF;

  IF NEW.granted_at IS NOT NULL AND (OLD.granted_at IS NULL OR NEW.granted_at > OLD.granted_at) THEN
    PERFORM public.bump_athlete_titles_board(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS athlete_growth_records_bump ON public.growth_records;
CREATE TRIGGER athlete_growth_records_bump
  AFTER INSERT OR UPDATE ON public.growth_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bump_athlete_growth_from_record();

DROP TRIGGER IF EXISTS athlete_member_titles_bump ON public.member_titles;
CREATE TRIGGER athlete_member_titles_bump
  AFTER INSERT OR UPDATE ON public.member_titles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bump_athlete_titles_from_member_title();

-- ── admin_save_growth_record: detect changes, skip no-op, growth bump only ───

DROP FUNCTION IF EXISTS public.admin_save_growth_record(uuid, integer, text, text, text);
DROP FUNCTION IF EXISTS public.admin_save_growth_record(uuid, integer, text, text);

CREATE OR REPLACE FUNCTION public.admin_save_growth_record(
  p_target_user uuid,
  p_new_level integer,
  p_standard_comment text DEFAULT NULL,
  p_custom_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_level integer;
  v_has_achieved boolean;
  v_has_new_level boolean;
  v_std text := nullif(left(trim(coalesce(p_standard_comment, '')), 8000), '');
  v_custom text := nullif(left(trim(coalesce(p_custom_comment, '')), 8000), '');
  v_last_level integer;
  v_last_std text;
  v_last_custom text;
  v_level_changed boolean := false;
  v_comment_changed boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_admin;
  IF NOT v_admin THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_target_user IS NULL THEN RAISE EXCEPTION 'missing_target'; END IF;
  IF p_new_level IS NULL OR p_new_level < 1 OR p_new_level > 10 THEN
    RAISE EXCEPTION 'invalid_level';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  v_level := p_new_level;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'growth_records' AND column_name = 'achieved_level'
  ) INTO v_has_achieved;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'growth_records' AND column_name = 'new_level'
  ) INTO v_has_new_level;

  IF v_has_achieved THEN
    SELECT gr.achieved_level, gr.standard_comment, gr.custom_comment
    INTO v_last_level, v_last_std, v_last_custom
    FROM public.growth_records gr
    WHERE gr.user_id = p_target_user
    ORDER BY gr.created_at DESC NULLS LAST
    LIMIT 1;
  ELSIF v_has_new_level THEN
    SELECT gr.new_level, gr.standard_comment, gr.custom_comment
    INTO v_last_level, v_last_std, v_last_custom
    FROM public.growth_records gr
    WHERE gr.user_id = p_target_user
    ORDER BY gr.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_level_changed := v_last_level IS NULL OR v_last_level IS DISTINCT FROM v_level;
  v_comment_changed := v_last_std IS DISTINCT FROM v_std OR v_last_custom IS DISTINCT FROM v_custom;

  IF NOT v_level_changed AND NOT v_comment_changed THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'unchanged',
      'member_level', v_level
    );
  END IF;

  IF v_level_changed THEN
    UPDATE public.profiles SET member_level = v_level WHERE id = p_target_user;
  END IF;

  IF v_has_achieved THEN
    INSERT INTO public.growth_records (user_id, achieved_level, standard_comment, custom_comment)
    VALUES (p_target_user, v_level, v_std, v_custom);
  ELSIF v_has_new_level THEN
    INSERT INTO public.growth_records (user_id, new_level, standard_comment, custom_comment)
    VALUES (p_target_user, v_level, v_std, v_custom);
  ELSE
    RAISE EXCEPTION 'growth_records_schema_unsupported';
  END IF;

  -- INSERT trigger → bump_athlete_growth_board only (growth_revision++)

  RETURN jsonb_build_object(
    'ok', true,
    'skipped', false,
    'level_changed', v_level_changed,
    'comment_changed', v_comment_changed,
    'member_level', v_level,
    'target_user', p_target_user
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_growth_record(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_athlete_growth_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_athlete_titles_seen() TO authenticated;

-- One-time: align seen revisions so existing users are not flooded with stale NEW
UPDATE public.profiles
SET
  athlete_growth_seen_revision = COALESCE(athlete_growth_revision, 0),
  athlete_titles_seen_revision = COALESCE(athlete_titles_revision, 0)
WHERE athlete_growth_seen_revision IS DISTINCT FROM COALESCE(athlete_growth_revision, 0)
   OR athlete_titles_seen_revision IS DISTINCT FROM COALESCE(athlete_titles_revision, 0);
