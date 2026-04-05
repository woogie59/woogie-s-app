-- Dashboard "최근 기록" live updates: subscribe from client when new rows are inserted/updated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'client_session_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_session_reports;
  END IF;
END $$;
