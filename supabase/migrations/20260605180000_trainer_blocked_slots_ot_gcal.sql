-- OT 예약처리: 회원명 + Google Calendar event id

ALTER TABLE public.trainer_blocked_slots
  ADD COLUMN IF NOT EXISTS member_name text,
  ADD COLUMN IF NOT EXISTS google_event_id text;

COMMENT ON COLUMN public.trainer_blocked_slots.member_name IS
  'OT 대상 회원 이름 (Google Calendar: {name}님수업)';
COMMENT ON COLUMN public.trainer_blocked_slots.google_event_id IS
  'Google Calendar event id for OT slot sync';
