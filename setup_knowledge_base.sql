-- ==========================================
-- Phase 4: Knowledge Base (Library) - Database Schema
-- ==========================================
-- Creates posts table for content management system
-- ==========================================

-- ==========================================
-- 1. CREATE POSTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- ==========================================
-- 3. AUTO-UPDATE updated_at TRIGGER
-- ==========================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. RLS POLICIES
-- ==========================================

-- Policy 1: All authenticated users can SELECT (view posts)
CREATE POLICY "Authenticated users can view all posts"
  ON posts
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Admins can INSERT new posts
CREATE POLICY "Admins can create posts"
  ON posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 3: Admins can UPDATE any post
CREATE POLICY "Admins can update posts"
  ON posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 4: Admins can DELETE any post
CREATE POLICY "Admins can delete posts"
  ON posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ==========================================
-- 6. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ==========================================

-- Insert sample posts
INSERT INTO posts (title, category, content, image_url) VALUES
(
  '체지방 감량을 위한 탄수화물 사이클링',
  'Nutrition',
  '탄수화물 사이클링(Carb Cycling)은 다이어트 정체기를 극복하고 근손실을 최소화하며 체지방을 태우는 고급 영양 전략입니다.

고강도 운동일에는 탄수화물 섭취를 늘리고, 휴식일에는 줄이는 전략적 식단 가이드입니다. 

이 방법은 신체가 지방을 에너지원으로 사용하도록 유도하면서도, 운동 퍼포먼스는 유지할 수 있게 합니다.',
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80'
),
(
  '3대 운동 증량 프로그램 (5x5)',
  'Workout',
  'StrongLifts 5x5 프로그램 가이드

3대 운동(스쿼트, 벤치프레스, 데드리프트) 중량을 늘리고 싶다면 가장 확실한 방법은 5x5 훈련법입니다.

원리는 간단합니다: 같은 무게로 5세트 5회씩 수행하고, 성공하면 다음 운동 시 2.5kg를 증가시킵니다. 실패하면 같은 무게를 유지합니다.

이 프로그램은 신경계 적응과 근력 향상에 최적화되어 있으며, 초보자부터 중급자까지 누구나 효과를 볼 수 있습니다.',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'
),
(
  '멘탈 관리: 운동 동기부여 유지법',
  'Mindset',
  '장기적인 운동 목표를 달성하기 위해서는 신체적 훈련만큼이나 정신적 관리가 중요합니다.

동기부여가 떨어질 때 사용할 수 있는 5가지 전략:
1. 작은 목표 설정하기
2. 운동 일지 작성하기
3. 커뮤니티 참여하기
4. 변화 사진 찍기
5. 보상 시스템 만들기

매일 완벽할 필요는 없습니다. 꾸준함이 완벽함을 이깁니다.',
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80'
);

-- ==========================================
-- 7. VERIFICATION QUERIES
-- ==========================================

-- Check table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'posts'
-- ORDER BY ordinal_position;

-- Check RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'posts';

-- View all posts
-- SELECT 
--   id,
--   title,
--   category,
--   LEFT(content, 50) as content_preview,
--   created_at
-- FROM posts
-- ORDER BY created_at DESC;

-- Count posts by category
-- SELECT 
--   category,
--   COUNT(*) as post_count
-- FROM posts
-- GROUP BY category;

-- ==========================================
-- CLEANUP (if needed)
-- ==========================================

-- DROP TABLE IF EXISTS posts CASCADE;
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
