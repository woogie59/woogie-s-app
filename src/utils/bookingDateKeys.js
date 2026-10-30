/**
 * 예약 UI(ClassBooking)와 동일: 브라우저 로컬 달력 기준 YYYY-MM-DD.
 * bookings.date 컬럼(TEXT)에 저장되는 형식과 맞춤.
 */
export function localCalendarDateKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** 한국 기준 달력 날짜 (관리자 단말·서버 KST와 맞출 때) */
export function kstDateKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * QR/체크인용: 오늘 문자열 후보 (TEXT 컬럼 bookings.date 와 동일 형식만 사용).
 * en-CA는 YYYY-MM-DD; gte/lte ISO 시각은 컬럼 타입이 TEXT일 때는 쓰지 않음.
 */
export function todayDateKeysForBookingMatch() {
  return [
    ...new Set([
      localCalendarDateKey(),
      kstDateKey(),
      new Date().toLocaleDateString('en-CA'),
    ]),
  ];
}

const p2 = (n) => String(n).padStart(2, '0');

/**
 * `bookings.date` + `bookings.time` → 로컬 캘린더의 수업 시작 시각 (ClassBooking/내 일정과 동일)
 */
export function parseBookingToLocalDate(booking) {
  if (!booking?.date) return null;
  const parts = String(booking.date)
    .slice(0, 10)
    .split('-')
    .map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const tm = booking.time || '09:00';
  const mm = String(tm).match(/(\d{1,2}):(\d{2})/);
  const hh = mm ? parseInt(mm[1], 10) : 9;
  const min = mm ? parseInt(mm[2], 10) : 0;
  return new Date(y, m - 1, d, hh, min, 0, 0);
}

/** 수업 시작 시각 기준 2시간 미만이면 앱에서 취소 불가 (회원). 관리자 화면은 미적용. */
export const MEMBER_CANCEL_MIN_LEAD_MS = 2 * 60 * 60 * 1000;
/** 리스트 버튼·title — 짧게 */
export const MEMBER_CANCEL_LOCK_TOOLTIP = '수업 2시간 이내 · 취소 안내';
/** 2시간 이내로 취소 시도 시 모달 본문 (ClassBooking「다음 주」잠금 톤과 맞춤) */
export const MEMBER_CANCEL_COACH_CONTACT_MESSAGE =
  '수업 2시간 이내 취소는 우기쌤에게 문의하시길 바랍니다.';

export function isMemberAppCancellationAllowed(
  booking,
  now = new Date(),
  minLeadMs = MEMBER_CANCEL_MIN_LEAD_MS
) {
  const t = parseBookingToLocalDate(booking);
  if (!t) return false;
  return t.getTime() - now.getTime() >= minLeadMs;
}

/** 수업 시작 1시간 미만이면 앱에서 예약 불가 (회원). */
export const MEMBER_BOOKING_MIN_LEAD_MS = 60 * 60 * 1000;
export const MEMBER_BOOKING_ONE_HOUR_MESSAGE =
  '1시간 이내 수업 예약은 담당 선생님에게 직접 연락주시길 바랍니다.';

export function isMemberAppBookingAllowed(
  dateStr,
  time,
  now = new Date(),
  minLeadMs = MEMBER_BOOKING_MIN_LEAD_MS
) {
  const start = parseBookingToLocalDate({ date: dateStr, time });
  if (!start) return false;
  return start.getTime() - now.getTime() >= minLeadMs;
}

/** 수업 시작까지 1시간 미만 남았지만 아직 시작 전인 슬롯 (안내 모달용). */
export function isSlotTooSoonForMemberBooking(
  dateStr,
  time,
  now = new Date(),
  minLeadMs = MEMBER_BOOKING_MIN_LEAD_MS
) {
  const start = parseBookingToLocalDate({ date: dateStr, time });
  if (!start) return false;
  const diff = start.getTime() - now.getTime();
  return diff > 0 && diff < minLeadMs;
}

/**
 * Rolling time-lock: "다음 주" 탭 — 매주 KST **토요일 13:00** 이후 열림 (트레이너 `trainer_settings`·토요 휴무와 무관).
 *
 * @see NEXT_WEEK_UNLOCK — 운영: `SATURDAY_1PM`. QA는 `WEDNESDAY_9PM_TEST` 만 ACTIVE로 바꿔 쓰면 됨.
 */
const NEXT_WEEK_UNLOCK = {
  /** 운영: 매주 토요일 13:00(오후 1시) KST */
  SATURDAY_1PM: { weekdayFromMon: 5, hour: 13, minute: 0 },
  /** QA용: 수요일 21:00 KST */
  WEDNESDAY_9PM_TEST: { weekdayFromMon: 2, hour: 21, minute: 0 },
};

const ACTIVE_NEXT_WEEK_UNLOCK = NEXT_WEEK_UNLOCK.SATURDAY_1PM;

/** QA: 이 프로필 이름만 토요일 1시 잠금 없이 다음 주 예약 가능 */
export const NEXT_WEEK_BOOKING_QA_PROFILE_NAME = '테스트용1';

/** QA 계정 전체: 신기능이 실시간 적용되는 프로필 이름들 (송이담 추가 — 사용자 지시 2026-10-19, 회원권 10/30 설정과 함께 승인) */
export const QA_PROFILE_NAMES = [NEXT_WEEK_BOOKING_QA_PROFILE_NAME, '송이담', '테스트2'];

/** "다음 주 예약" 잠금 우회 계정 — UI QA 게이트와 별도. 송이담은 2026-10-20 사용자 지시로 일반 회원과 동일하게 잠금 적용. */
export const NEXT_WEEK_BYPASS_PROFILE_NAMES = [
  NEXT_WEEK_BOOKING_QA_PROFILE_NAME,
  '테스트2',
  // 2026-10-29 사용자 지시(phonemsg-01M63AAY8W5D4VPFK6VF4GSRMS + 18:01 유지 지시): 김윤서 회원 다음 주 예약 상시 조기 오픈. 회수 지시 전까지 유지.
  '김윤서',
  // 2026-10-30 사용자 지시(phonemsg-01M66AMFC45ZF39A8P5QHN12Z9): 김다혜 회원 다음 주 예약 상시 조기 오픈. "따로 말하지 않으면 유지" — 회수 지시 전까지 유지.
  // 동명 회원 없음 확인(DB 조회: id 8921f067-313f-4ef0-8b70-78da8936e4bc).
  '김다혜',
];

/** QA 계정 여부 (프로필 이름 기준, 앞뒤 공백 무시) */
export const isQaProfileName = (profileName) => QA_PROFILE_NAMES.includes(String(profileName || '').trim());

/**
 * 신규 회원 홈/달력/예약 UI 게이트 — 2026-10-20 전체 회원 오픈으로 항상 true.
 * 주의: "다음 주 예약" 토요일 1시 잠금 우회는 이 함수가 아니라 isQaProfileName(QA 계정)만 적용.
 * 롤백 시 이 함수를 (profileName) => isQaProfileName(profileName) 로 되돌리면 QA 계정만 신규 UI.
 */
export const isNewMemberUiEnabled = () => true;

/** "다음 주" 잠금 시 탭/토스트 — 운영 문구 (요청 확정) */
const NEXT_WEEK_OPEN_COPY = '다음 주 예약은 토요일 1시에 오픈됩니다.';

/** 수업 예약 화면 잠금 토스트 (ClassBooking: 다음 주 클릭 시) */
export const NEXT_WEEK_LOCKED_TOAST_MESSAGE =
  ACTIVE_NEXT_WEEK_UNLOCK === NEXT_WEEK_UNLOCK.WEDNESDAY_9PM_TEST
    ? '다음 주 수업은 수요일 오후 9시(한국시간, 테스트)부터 신청 가능합니다.'
    : NEXT_WEEK_OPEN_COPY;

/** 잠금 전체 화면 (lead+highlight+trail = 한 문장) */
export const NEXT_WEEK_LOCKED_BANNER_HTML =
  ACTIVE_NEXT_WEEK_UNLOCK === NEXT_WEEK_UNLOCK.WEDNESDAY_9PM_TEST
    ? {
        lead: '다음 주 예약은 ',
        highlight: '매주 수요일 오후 9:00(한국시간·테스트)',
        trail: '부터 열리며, 확인 후 토요일 오후 1시(운영)으로 복구 예정입니다.',
      }
    : {
        lead: '다음 주 예약은 ',
        highlight: '오후 1시',
        trail: '에 오픈됩니다.',
      };

function buildKstThisWeekUnlockInstant(anchor, cfg) {
  const ymd = kstDateKey(anchor);
  const [y, m, d] = ymd.split('-').map(Number);
  const ref = new Date(`${y}-${p2(m)}-${p2(d)}T12:00:00+09:00`);
  const dow = ref.getUTCDay();
  const offsetMon = dow === 0 ? 6 : dow - 1;
  const daysToUnlockDay = cfg.weekdayFromMon - offsetMon;
  const dayInstant = new Date(ref.getTime() + daysToUnlockDay * 86400000);
  const [yu, mu, du] = kstDateKey(dayInstant).split('-').map(Number);
  return new Date(
    `${yu}-${p2(mu)}-${p2(du)}T${p2(cfg.hour)}:${p2(cfg.minute)}:00+09:00`
  );
}

export function isNextWeekBookingUnlockedKST(anchor = new Date(), profileName = '') {
  if (NEXT_WEEK_BYPASS_PROFILE_NAMES.includes(String(profileName || '').trim())) {
    return true;
  }
  const unlock = buildKstThisWeekUnlockInstant(anchor, ACTIVE_NEXT_WEEK_UNLOCK);
  return anchor.getTime() >= unlock.getTime();
}
