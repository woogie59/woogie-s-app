-- EXP audit trail (production may already have this table; IF NOT EXISTS keeps push idempotent).

CREATE TABLE IF NOT EXISTS public.exp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  member_stat_id uuid REFERENCES public.member_stats (id) ON DELETE SET NULL,
  category_name text,
  exp_before numeric(10, 2),
  exp_after numeric(10, 2),
  exp_delta numeric(10, 2),
  profile_level_before integer,
  profile_level_after integer,
  category_levels_gained integer NOT NULL DEFAULT 0,
  entry_kind text,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exp_logs_user_created ON public.exp_logs (user_id, created_at DESC);

ALTER TABLE public.exp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access exp_logs" ON public.exp_logs;
DROP POLICY IF EXISTS "Members read own exp_logs" ON public.exp_logs;

CREATE POLICY "Admins full access exp_logs"
  ON public.exp_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Members read own exp_logs"
  ON public.exp_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exp_logs TO authenticated;

COMMENT ON TABLE public.exp_logs IS 'Per-save EXP / level events with admin reason (p_reason from RPC).';
