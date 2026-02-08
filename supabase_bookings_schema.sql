-- ==========================================
-- Task 2.1: Class Booking System - Database Schema
-- ==========================================
-- This schema creates a booking system for 1-on-1 personal training sessions
-- Features:
-- 1. bookings table to store all class reservations
-- 2. Unique constraint to prevent double-booking
-- 3. RLS policies for user/admin access control
-- 4. Helper functions for booking management
-- ==========================================

-- ==========================================
-- CREATE BOOKINGS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  -- Ensure valid time format (HH:00)
  CONSTRAINT valid_time_format CHECK (time ~ '^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'),
  
  -- Prevent booking in the past
  CONSTRAINT no_past_bookings CHECK (date >= CURRENT_DATE)
);

-- ==========================================
-- CREATE UNIQUE CONSTRAINT
-- ==========================================
-- Prevents double-booking: Only one booking per date+time slot
-- Excludes cancelled bookings from the constraint

CREATE UNIQUE INDEX unique_booking_slot 
  ON bookings (date, time) 
  WHERE status != 'cancelled';

-- ==========================================
-- CREATE INDEXES FOR PERFORMANCE
-- ==========================================

-- Index for user's bookings query
CREATE INDEX idx_bookings_user_id ON bookings(user_id);

-- Index for date range queries
CREATE INDEX idx_bookings_date ON bookings(date);

-- Index for status queries
CREATE INDEX idx_bookings_status ON bookings(status);

-- Composite index for common queries
CREATE INDEX idx_bookings_date_time ON bookings(date, time);

-- ==========================================
-- ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Policy 1: Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON bookings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own bookings
CREATE POLICY "Users can create own bookings"
  ON bookings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own bookings (for cancellation)
CREATE POLICY "Users can update own bookings"
  ON bookings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own bookings
CREATE POLICY "Users can delete own bookings"
  ON bookings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy 5: Admins can view all bookings
CREATE POLICY "Admins can view all bookings"
  ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 6: Admins can insert any booking
CREATE POLICY "Admins can create any booking"
  ON bookings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 7: Admins can update any booking
CREATE POLICY "Admins can update any booking"
  ON bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 8: Admins can delete any booking
CREATE POLICY "Admins can delete any booking"
  ON bookings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ==========================================
-- HELPER FUNCTION: Auto-update timestamp
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- HELPER FUNCTION: Get available time slots
-- ==========================================
-- Returns all time slots (10:00-21:00) that are NOT already booked for a given date

CREATE OR REPLACE FUNCTION get_available_slots(booking_date DATE)
RETURNS TABLE(time_slot TEXT, is_available BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  WITH time_slots AS (
    SELECT to_char(generate_series(
      '10:00'::time,
      '21:00'::time,
      '1 hour'::interval
    ), 'HH24:MI') AS slot
  ),
  booked_slots AS (
    SELECT time
    FROM bookings
    WHERE date = booking_date
      AND status != 'cancelled'
  )
  SELECT 
    ts.slot AS time_slot,
    (bs.time IS NULL) AS is_available
  FROM time_slots ts
  LEFT JOIN booked_slots bs ON ts.slot = bs.time
  ORDER BY ts.slot;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_available_slots(DATE) TO authenticated;

-- ==========================================
-- HELPER FUNCTION: Cancel booking
-- ==========================================
-- Cancels a booking (soft delete by changing status)

CREATE OR REPLACE FUNCTION cancel_booking(booking_id UUID)
RETURNS JSON AS $$
DECLARE
  booking_record RECORD;
  user_name TEXT;
  booking_date DATE;
  booking_time TEXT;
BEGIN
  -- Get booking details with lock
  SELECT b.*, p.name
  INTO booking_record, user_name
  FROM bookings b
  JOIN profiles p ON b.user_id = p.id
  WHERE b.id = booking_id
  FOR UPDATE;

  -- Check if booking exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Check if already cancelled
  IF booking_record.status = 'cancelled' THEN
    RAISE EXCEPTION 'Booking is already cancelled';
  END IF;

  -- Check if booking is in the past
  IF booking_record.date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot cancel past bookings';
  END IF;

  -- Update booking status
  UPDATE bookings
  SET 
    status = 'cancelled',
    cancelled_at = NOW()
  WHERE id = booking_id;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'booking_id', booking_id,
    'user_name', user_name,
    'date', booking_record.date,
    'time', booking_record.time,
    'message', 'Booking cancelled successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Cancellation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cancel_booking(UUID) TO authenticated;

-- ==========================================
-- HELPER FUNCTION: Create booking
-- ==========================================
-- Creates a new booking with validation

CREATE OR REPLACE FUNCTION create_booking(
  p_user_id UUID,
  p_date DATE,
  p_time TEXT
)
RETURNS JSON AS $$
DECLARE
  new_booking_id UUID;
  user_name TEXT;
  user_sessions INT;
BEGIN
  -- Get user info
  SELECT name, remaining_sessions
  INTO user_name, user_sessions
  FROM profiles
  WHERE id = p_user_id;

  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if user has remaining sessions
  IF user_sessions IS NULL OR user_sessions <= 0 THEN
    RAISE EXCEPTION 'No remaining sessions available. Please purchase more sessions.';
  END IF;

  -- Check if date is not in the past
  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot book in the past';
  END IF;

  -- Check if time slot is valid (10:00-21:00)
  IF p_time < '10:00' OR p_time > '21:00' THEN
    RAISE EXCEPTION 'Invalid time slot. Available times: 10:00 - 21:00';
  END IF;

  -- Check if slot is available (unique constraint will catch this, but we check first for better error message)
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE date = p_date
      AND time = p_time
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Time slot already booked. Please choose another time.';
  END IF;

  -- Create the booking
  INSERT INTO bookings (user_id, date, time)
  VALUES (p_user_id, p_date, p_time)
  RETURNING id INTO new_booking_id;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'booking_id', new_booking_id,
    'user_id', p_user_id,
    'user_name', user_name,
    'date', p_date,
    'time', p_time,
    'remaining_sessions', user_sessions,
    'message', 'Booking created successfully'
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Time slot already booked. Please choose another time.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Booking failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_booking(UUID, DATE, TEXT) TO authenticated;

-- ==========================================
-- SEED DATA (Optional - for testing)
-- ==========================================
-- Uncomment to add sample bookings for testing

/*
-- Get a test user ID (replace with actual user ID from your profiles table)
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Get first user with role='user'
  SELECT id INTO test_user_id FROM profiles WHERE role = 'user' LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Create some sample bookings
    INSERT INTO bookings (user_id, date, time) VALUES
      (test_user_id, CURRENT_DATE + 1, '10:00'),
      (test_user_id, CURRENT_DATE + 1, '14:00'),
      (test_user_id, CURRENT_DATE + 2, '11:00');
  END IF;
END $$;
*/

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- Run these to verify the setup

-- Check table structure
-- SELECT * FROM information_schema.columns WHERE table_name = 'bookings';

-- Check RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'bookings';

-- Test available slots function
-- SELECT * FROM get_available_slots(CURRENT_DATE + 1);

-- View all bookings with user info
-- SELECT 
--   b.id,
--   p.name,
--   p.email,
--   b.date,
--   b.time,
--   b.status,
--   b.created_at
-- FROM bookings b
-- JOIN profiles p ON b.user_id = p.id
-- ORDER BY b.date, b.time;

-- ==========================================
-- CLEANUP (if needed)
-- ==========================================
-- Uncomment to remove everything

-- DROP TABLE IF EXISTS bookings CASCADE;
-- DROP FUNCTION IF EXISTS get_available_slots(DATE);
-- DROP FUNCTION IF EXISTS cancel_booking(UUID);
-- DROP FUNCTION IF EXISTS create_booking(UUID, DATE, TEXT);
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
