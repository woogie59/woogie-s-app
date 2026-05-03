-- Physical Autonomy roadmap: per-EXP admin rationale, growth ledger timeline, profile level cap at 10 (enforced in RPCs, not a hard CHECK for legacy rows).

ALTER TABLE public.member_stats
  ADD COLUMN IF NOT EXISTS achievement_note text;

COMMENT ON COLUMN public.member_stats.achievement_note IS 'Admin rationale for the latest EXP commit on this category; full history in member_growth_ledger.';

CREATE TABLE IF NOT EXISTS public.member_growth_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  member_stat_id uuid REFERENCES public.member_stats (id) ON DELETE SET NULL,
  category_name text,
  entry_kind text NOT NULL CHECK (entry_kind IN ('exp_adjust', 'level_up')),
  exp_before numeric(10, 2),
  exp_after numeric(10, 2),
  exp_delta numeric(10, 2),
  profile_level_before integer NOT NULL,
  profile_level_after integer NOT NULL,
  category_levels_gained integer NOT NULL DEFAULT 0,
  achievement_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_growth_ledger_user_created
  ON public.member_growth_ledger (user_id, created_at DESC);

ALTER TABLE public.member_growth_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access member_growth_ledger"
  ON public.member_growth_ledger FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Members read own growth ledger"
  ON public.member_growth_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_growth_ledger TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_force_update_level(
  p_target_user uuid,
  p_new_level integer,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_level integer;
BEGIN
  IF p_new_level IS NULL OR p_new_level < 1 THEN
    RAISE EXCEPTION 'invalid_level';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  v_level := least(10, greatest(1, p_new_level));

  UPDATE public.profiles
  SET member_level = v_level
  WHERE id = p_target_user;

  RETURN jsonb_build_object(
    'ok', true,
    'member_level', v_level,
    'target_user', p_target_user
  );
END;
$$;

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

  -- Net change along the EXP meter the admin requested (absolute p_new_exp vs previous stored bar).
  v_exp_delta := round(v_new_exp - coalesce(v_old_exp, 0), 2);

  v_note := nullif(left(trim(coalesce(p_reason, '')), 4000), '');

  UPDATE public.member_stats
  SET
    exp_percent = v_remainder,
    level = level + v_gained,
    achievement_note = CASE
      WHEN v_note IS NOT NULL THEN v_note
      ELSE achievement_note
    END,
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

  INSERT INTO public.member_growth_ledger (
    user_id,
    member_stat_id,
    category_name,
    entry_kind,
    exp_before,
    exp_after,
    exp_delta,
    profile_level_before,
    profile_level_after,
    category_levels_gained,
    achievement_note,
    created_by
  )
  VALUES (
    p_target_user,
    p_stat_id,
    v_cat,
    v_entry_kind,
    round(coalesce(v_old_exp, 0), 2),
    v_remainder,
    v_exp_delta,
    v_old_ml,
    coalesce(v_new_ml, v_old_ml),
    v_gained,
    v_note,
    auth.uid()
  );

  RETURN jsonb_build_object(
    'member_level', coalesce(v_new_ml, v_old_ml),
    'levels_gained', v_gained,
    'exp_percent', v_remainder,
    'category_level', (SELECT level FROM public.member_stats WHERE id = p_stat_id)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_apply_member_stat_exp IS 'Admin-only: apply EXP; writes achievement_note, member_growth_ledger, caps profile.member_level at 10.';
