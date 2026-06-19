-- Section-level NEW badges: growth (level/comments) vs titles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS athlete_growth_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS athlete_growth_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS athlete_titles_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS athlete_titles_seen_at timestamptz;

COMMENT ON COLUMN public.profiles.athlete_growth_updated_at IS 'Admin updated level/growth record or comment.';
COMMENT ON COLUMN public.profiles.athlete_growth_seen_at IS 'Member opened 성장기록 section.';
COMMENT ON COLUMN public.profiles.athlete_titles_updated_at IS 'Admin granted/unlocked a title.';
COMMENT ON COLUMN public.profiles.athlete_titles_seen_at IS 'Member opened 칭호 목록.';

DROP FUNCTION IF EXISTS public.bump_athlete_board_updated(uuid);

CREATE OR REPLACE FUNCTION public.bump_athlete_board_updated(
  p_user_id uuid,
  p_section text DEFAULT 'all'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sec text := lower(trim(coalesce(p_section, 'all')));
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    athlete_board_updated_at = now(),
    athlete_growth_updated_at = CASE
      WHEN v_sec IN ('growth', 'level', 'all') THEN now()
      ELSE athlete_growth_updated_at
    END,
    athlete_titles_updated_at = CASE
      WHEN v_sec IN ('titles', 'title', 'all') THEN now()
      ELSE athlete_titles_updated_at
    END
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_athlete_growth_seen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET athlete_growth_seen_at = now()
  WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_athlete_titles_seen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET athlete_titles_seen_at = now()
  WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_athlete_board_updated(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_athlete_growth_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_athlete_titles_seen() TO authenticated;

-- EXP / level admin path → growth section
CREATE OR REPLACE FUNCTION public.admin_apply_member_stat_exp(
  p_target_user uuid,
  p_stat_id uuid,
  p_new_exp numeric,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_old_exp numeric;
  v_new_exp numeric;
  v_gained integer;
  v_remainder numeric;
  v_stat_user uuid;
  v_cat text;
  v_old_ml integer;
  v_new_ml integer;
  v_stat_level integer;
  v_exp_delta numeric;
  v_note text;
  v_entry_kind text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_new_exp IS NULL OR p_new_exp < 0 THEN
    RAISE EXCEPTION 'invalid_exp';
  END IF;

  SELECT ms.user_id, ms.category_name, ms.exp_percent, ms.level
  INTO v_stat_user, v_cat, v_old_exp, v_stat_level
  FROM public.member_stats ms
  WHERE ms.id = p_stat_id
  FOR UPDATE;

  IF v_stat_user IS NULL THEN
    RAISE EXCEPTION 'stat_not_found';
  END IF;

  IF v_stat_user <> p_target_user THEN
    RAISE EXCEPTION 'user_mismatch';
  END IF;

  v_new_exp := least(p_new_exp, 999999.99);

  SELECT COALESCE(member_level, 1) INTO v_old_ml FROM public.profiles WHERE id = p_target_user FOR UPDATE;

  v_gained := greatest(0, floor(v_new_exp / 100)::integer - floor(coalesce(v_old_exp, 0) / 100)::integer);
  v_remainder := round((v_new_exp % 100)::numeric, 2);
  IF v_remainder >= 100 THEN
    v_remainder := 0;
  END IF;

  v_exp_delta := round(v_new_exp - coalesce(v_old_exp, 0), 2);
  v_note := nullif(left(trim(coalesce(p_reason, '')), 4000), '');

  UPDATE public.member_stats
  SET
    exp_percent = v_remainder,
    level = level + v_gained,
    achievement_note = CASE WHEN v_note IS NOT NULL THEN v_note ELSE achievement_note END,
    updated_at = now()
  WHERE id = p_stat_id;

  v_new_ml := v_old_ml;

  IF v_gained > 0 THEN
    UPDATE public.profiles
    SET member_level = least(10, member_level + v_gained)
    WHERE id = p_target_user
    RETURNING member_level INTO v_new_ml;

    IF v_new_ml > v_old_ml THEN
      INSERT INTO public.level_logs (user_id, old_member_level, new_member_level, member_stat_id, category_name)
      VALUES (p_target_user, v_old_ml, v_new_ml, p_stat_id, v_cat);
    END IF;
  END IF;

  v_entry_kind := CASE WHEN v_gained > 0 THEN 'level_up' ELSE 'exp_adjust' END;

  INSERT INTO public.exp_logs (
    user_id, member_stat_id, category_name, entry_kind,
    exp_before, exp_after, exp_delta,
    profile_level_before, profile_level_after, category_levels_gained,
    reason, created_by
  )
  VALUES (
    p_target_user, p_stat_id, v_cat, v_entry_kind,
    round(coalesce(v_old_exp, 0), 2), v_remainder, v_exp_delta,
    v_old_ml, coalesce(v_new_ml, v_old_ml), v_gained,
    v_note, auth.uid()
  );

  PERFORM public.bump_athlete_board_updated(p_target_user, 'growth');

  RETURN jsonb_build_object(
    'member_level', coalesce(v_new_ml, v_old_ml),
    'levels_gained', v_gained,
    'exp_percent', v_remainder,
    'category_level', (SELECT level FROM public.member_stats WHERE id = p_stat_id),
    'level_up', v_new_ml > v_old_ml
  );
END;
$$;
