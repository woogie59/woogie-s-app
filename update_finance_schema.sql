-- ==========================================
-- Task 3.1: Database Update for Finance
-- ==========================================
-- Adds financial tracking to check-in system
-- ==========================================

-- ==========================================
-- 1. ADD price_per_session TO profiles TABLE
-- ==========================================

-- Add column to store the price per session for each user
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS price_per_session INT DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN profiles.price_per_session IS 'Price in cents (or base currency unit) per training session for this user';

-- ==========================================
-- 2. CREATE attendance_logs TABLE
-- ==========================================

-- This table logs every check-in with a snapshot of the session price
-- at the time of check-in (for historical accuracy)
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  check_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_price_snapshot INT NOT NULL,
  
  -- Add index for common queries
  CONSTRAINT attendance_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_id ON attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_check_in_at ON attendance_logs(check_in_at);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_date ON attendance_logs(user_id, check_in_at);

-- ==========================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. RLS POLICIES FOR attendance_logs
-- ==========================================

-- Policy 1: Admins can SELECT all attendance logs
-- (Assumes you have a 'role' column in profiles with value 'admin')
CREATE POLICY "Admins can view all attendance logs"
  ON attendance_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 2: Users can SELECT only their own attendance logs
CREATE POLICY "Users can view own attendance logs"
  ON attendance_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 3: INSERT is handled by the check_in_user function
-- No direct INSERT policy needed (function has SECURITY DEFINER)

-- ==========================================
-- 6. UPDATE check_in_user RPC FUNCTION
-- ==========================================

-- 1. 기존 함수가 있다면 과감하게 삭제 (리턴 타입 충돌 방지)
DROP FUNCTION IF EXISTS public.check_in_user(uuid);

-- 2. 새로운 함수 생성 (단가 기록 기능 포함)
CREATE OR REPLACE FUNCTION check_in_user(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  current_sessions INT;
  current_price INT;
  new_sessions INT;
BEGIN
  -- 회원 정보(남은 횟수, 단가) 조회
  SELECT remaining_sessions, price_per_session
  INTO current_sessions, current_price
  FROM public.profiles
  WHERE id = user_uuid;

  -- 횟수 없으면 에러 처리
  IF current_sessions IS NULL OR current_sessions < 1 THEN
    RAISE EXCEPTION 'No remaining sessions';
  END IF;

  -- 횟수 1회 차감
  new_sessions := current_sessions - 1;

  UPDATE public.profiles
  SET remaining_sessions = new_sessions
  WHERE id = user_uuid;

  -- ★ 엑셀 대신 여기에 자동 기록! ★
  INSERT INTO public.attendance_logs (user_id, session_price_snapshot)
  VALUES (user_uuid, COALESCE(current_price, 0));

  RETURN jsonb_build_object(
    'success', true, 
    'remaining', new_sessions,
    'price_logged', COALESCE(current_price, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_in_user(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION check_in_user IS 'Check in a user, decrement their sessions, and log attendance with price snapshot';

-- ==========================================
-- 7. VERIFICATION QUERIES
-- ==========================================

-- Check if price_per_session column was added
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'price_per_session';

-- Check attendance_logs table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'attendance_logs'
-- ORDER BY ordinal_position;

-- Check RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'attendance_logs';

-- Test the updated function (replace with real UUID)
-- SELECT check_in_user('USER_UUID_HERE');

-- View attendance logs with user info
-- SELECT 
--   al.*,
--   p.name,
--   p.email,
--   p.remaining_sessions
-- FROM attendance_logs al
-- JOIN profiles p ON al.user_id = p.id
-- ORDER BY al.check_in_at DESC;

-- Calculate total revenue
-- SELECT 
--   SUM(session_price_snapshot) as total_revenue_cents,
--   COUNT(*) as total_check_ins,
--   AVG(session_price_snapshot) as avg_price_per_session
-- FROM attendance_logs;

-- Revenue by user
-- SELECT 
--   p.name,
--   p.email,
--   COUNT(al.id) as total_check_ins,
--   SUM(al.session_price_snapshot) as total_spent_cents,
--   AVG(al.session_price_snapshot) as avg_price_per_session
-- FROM attendance_logs al
-- JOIN profiles p ON al.user_id = p.id
-- GROUP BY p.id, p.name, p.email
-- ORDER BY total_spent_cents DESC;

-- ==========================================
-- 8. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ==========================================

-- Update existing users with sample prices
-- UPDATE profiles 
-- SET price_per_session = 5000  -- $50.00 in cents
-- WHERE role = 'user';

-- ==========================================
-- CLEANUP (if needed)
-- ==========================================

-- DROP TABLE IF EXISTS attendance_logs CASCADE;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS price_per_session;
-- DROP FUNCTION IF EXISTS check_in_user(UUID);
