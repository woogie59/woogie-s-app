-- ==========================================
-- Task 2: Class Booking System - Simplified Setup
-- ==========================================
-- Creates bookings table with RLS policies
-- ==========================================

-- ==========================================
-- 1. CREATE BOOKINGS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. UNIQUE CONSTRAINT
-- ==========================================
-- Prevents double-booking: Only one booking per date+time slot

CREATE UNIQUE INDEX unique_booking_slot 
  ON bookings (date, time);

-- ==========================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_date_time ON bookings(date, time);

-- ==========================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. RLS POLICIES
-- ==========================================

-- Policy 1: Users can INSERT only for themselves
CREATE POLICY "Users can create own bookings"
  ON bookings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Authenticated users can SELECT ALL bookings (to see which slots are taken)
CREATE POLICY "Authenticated users can view all bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy 3: Users can DELETE only their own bookings
CREATE POLICY "Users can delete own bookings"
  ON bookings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy 4 (OPTIONAL): Admin can DELETE any booking (for Task 2.4)
-- Uncomment this if you want admins to be able to cancel any booking
-- First ensure your profiles table has a 'role' column
-- CREATE POLICY "Admins can delete any booking"
--   ON bookings
--   FOR DELETE
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.role = 'admin'
--     )
--   );

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Check table structure
-- SELECT * FROM information_schema.columns WHERE table_name = 'bookings';

-- Check RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'bookings';

-- View all bookings
-- SELECT 
--   b.*,
--   p.name,
--   p.email
-- FROM bookings b
-- JOIN profiles p ON b.user_id = p.id
-- ORDER BY b.date, b.time;

-- ==========================================
-- CLEANUP (if needed)
-- ==========================================

-- DROP TABLE IF EXISTS bookings CASCADE;
