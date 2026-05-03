-- Ensure authenticated role can reach member_stats / level_logs under RLS (fixes silent insert denials when GRANTs were missing).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.level_logs TO authenticated;

-- Idempotent policy refresh (safe if names match migration 20260503120000)
DROP POLICY IF EXISTS "Admins full access member_stats" ON public.member_stats;
DROP POLICY IF EXISTS "Members read own member_stats" ON public.member_stats;

CREATE POLICY "Admins full access member_stats"
  ON public.member_stats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Members read own member_stats"
  ON public.member_stats FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
