-- Session title for archive list / gateway teaser
ALTER TABLE public.client_session_reports
  ADD COLUMN IF NOT EXISTS session_focus TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.client_session_reports.session_focus IS 'Short label e.g. "상체 세션", "가슴 및 삼두 세션"';
