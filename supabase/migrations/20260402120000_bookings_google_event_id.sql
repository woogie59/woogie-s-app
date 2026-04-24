-- Google Calendar two-way id for Edge Function `google-calendar-sync`
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

COMMENT ON COLUMN public.bookings.google_event_id IS 'googleapis calendar event id (LabDot PT sync)';
