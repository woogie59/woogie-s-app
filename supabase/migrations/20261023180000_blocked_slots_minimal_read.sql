-- =============================================================================
-- [후보 — 승인 전 적용 금지] trainer_blocked_slots 읽기 최소화
--
-- 발견(독립 리뷰): "Anyone can read trainer_blocked_slots" (authenticated SELECT
-- USING true)로 로그인 회원 누구나 member_name / google_event_id / 날짜·시간을
-- 읽을 수 있다. 실제 악용 확인은 없음.
--
-- 대응: 회원 직접 SELECT를 거두고, 예약 화면이 실제로 쓰는 날짜·시간·kind만
-- RPC로 반환한다. 관리자 정책("Admins manage trainer_blocked_slots")은 유지.
--
-- 전수 부작용 조사(2026-10-23, src 전체 grep):
--   - 회원 경로: src/features/booking/ClassBooking.jsx — select('*') 후
--     isSlotBlocked()에 block_date/block_time만 사용 → RPC로 대체 가능 (함께 배포 필수)
--   - 관리자 경로: App.jsx(isAdminSchedule 가드), AdminBookingSettingsPanel.jsx — 관리자
--     정책으로 계속 전체 열 사용 가능, 변경 없음
--   - 오티 공개 페이지: ot_get_availability(SECURITY DEFINER)가 읽으므로 anon 권한 불필요
--
-- 배포 순서: 이 migration과 ClassBooking.jsx RPC 전환은 같은 배포에 포함해야 한다.
-- =============================================================================

-- 1) 회원용 최소 읽기 RPC (날짜·시간·kind만)
CREATE OR REPLACE FUNCTION public.get_blocked_slots_public(p_date date)
RETURNS TABLE (block_date date, block_time text, kind text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT b.block_date, b.block_time, b.kind
  FROM public.trainer_blocked_slots b
  WHERE b.block_date = p_date;
$$;

REVOKE ALL ON FUNCTION public.get_blocked_slots_public(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_blocked_slots_public(date) TO authenticated;

-- 2) 회원의 테이블 직접 읽기 회수 (관리자 정책은 유지)
DROP POLICY IF EXISTS "Anyone can read trainer_blocked_slots" ON public.trainer_blocked_slots;
