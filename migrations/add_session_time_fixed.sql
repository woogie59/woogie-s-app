-- Add session_time_fixed to attendance_logs for booking-matched display
-- Stores the scheduled class time (HH:mm) when available from bookings
ALTER TABLE attendance_logs
ADD COLUMN IF NOT EXISTS session_time_fixed TEXT;

COMMENT ON COLUMN attendance_logs.session_time_fixed IS 'Scheduled class time in HH:mm (24h) from booking';
