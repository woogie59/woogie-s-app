-- Add opt-in flag for the Athlete System (level/title gamification).
-- Default false so existing users are unaffected until an admin explicitly enables them.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_athlete_system_enabled boolean NOT NULL DEFAULT false;
