-- Today's Clinical Report (per member, per calendar day)
CREATE TABLE IF NOT EXISTS public.client_session_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  workout_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  coach_comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_client_session_reports_user_date
  ON public.client_session_reports (user_id, report_date DESC);

ALTER TABLE public.client_session_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own session reports"
  ON public.client_session_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins full access session reports"
  ON public.client_session_reports FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

COMMENT ON TABLE public.client_session_reports IS 'Daily workout summary + coach note for client home card';
