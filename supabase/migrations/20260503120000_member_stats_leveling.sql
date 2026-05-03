-- Member leveling & per-category stats (admin-managed for now)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_level integer NOT NULL DEFAULT 1
    CHECK (member_level >= 1);

COMMENT ON COLUMN public.profiles.member_level IS 'Overall gamified level; rises when any member_stats category completes EXP cycles.';

CREATE TABLE IF NOT EXISTS public.member_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  category_name text NOT NULL,
  exp_percent numeric(6, 2) NOT NULL DEFAULT 0 CHECK (exp_percent >= 0 AND exp_percent < 100),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_name)
);

CREATE INDEX IF NOT EXISTS idx_member_stats_user_id ON public.member_stats (user_id);

CREATE TABLE IF NOT EXISTS public.level_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  old_member_level integer NOT NULL,
  new_member_level integer NOT NULL,
  member_stat_id uuid REFERENCES public.member_stats (id) ON DELETE SET NULL,
  category_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_level_logs_user_created ON public.level_logs (user_id, created_at DESC);

ALTER TABLE public.member_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_logs ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins full access member_stats"
  ON public.member_stats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins full access level_logs"
  ON public.level_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Members can read own stats (future client UI); writes remain admin-only
CREATE POLICY "Members read own member_stats"
  ON public.member_stats FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.member_stats IS 'Per-category EXP (0–99.99 stored) and category level; admin adjusts via app.';
COMMENT ON TABLE public.level_logs IS 'History of profile.member_level changes for auditing and notification hooks.';

CREATE OR REPLACE FUNCTION public.admin_apply_member_stat_exp(
  p_target_user uuid,
  p_stat_id uuid,
  p_new_exp numeric
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

  -- Stored exp is always < 100; p_new_exp may exceed 100 for multi-cycle / overflow in one update.
  v_gained := greatest(0, floor(v_new_exp / 100)::integer - floor(coalesce(v_old_exp, 0) / 100)::integer);
  v_remainder := round((v_new_exp % 100)::numeric, 2);
  IF v_remainder >= 100 THEN
    v_remainder := 0;
  END IF;

  UPDATE public.member_stats
  SET
    exp_percent = v_remainder,
    level = level + v_gained,
    updated_at = now()
  WHERE id = p_stat_id;

  IF v_gained > 0 THEN
    UPDATE public.profiles
    SET member_level = member_level + v_gained
    WHERE id = p_target_user
    RETURNING member_level INTO v_new_ml;

    INSERT INTO public.level_logs (user_id, old_member_level, new_member_level, member_stat_id, category_name)
    VALUES (p_target_user, v_old_ml, v_new_ml, p_stat_id, v_cat);
  ELSE
    v_new_ml := v_old_ml;
  END IF;

  RETURN jsonb_build_object(
    'member_level', v_new_ml,
    'levels_gained', v_gained,
    'exp_percent', v_remainder,
    'category_level', (SELECT level FROM public.member_stats WHERE id = p_stat_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_member_stat_exp(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_member_stat_exp(uuid, uuid, numeric) TO authenticated;

COMMENT ON FUNCTION public.admin_apply_member_stat_exp IS 'Admin-only: set absolute EXP for a category; level-ups update profiles.member_level, member_stats.level, and level_logs.';
