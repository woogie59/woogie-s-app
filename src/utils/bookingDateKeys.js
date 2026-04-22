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

/** 수업 2시간 전까지만 앱 취소 (회원). 관리자 화면은 이 제한을 적용하지 않음. */
export const MEMBER_CANCEL_MIN_LEAD_MS = 2 * 60 * 60 * 1000;
export const MEMBER_CANCEL_LOCK_TOOLTIP = '수업 2시간 전까지만 앱에서 취소 가능합니다.';

export function isMemberAppCancellationAllowed(
  booking,
  now = new Date(),
  minLeadMs = MEMBER_CANCEL_MIN_LEAD_MS
) {
  const t = parseBookingToLocalDate(booking);
  if (!t) return false;
  return t.getTime() - now.getTime() >= minLeadMs;
}

/**
 * Rolling time-lock: "다음 주" 탭 — 이번 KST 주의 지정 요일·시각 이후 열리고, 이후로 계속 열림.
 *
 * @see NEXT_WEEK_UNLOCK — 테스트(수 21:00) 끝나면 `SATURDAY_10AM`으로 되돌릴 것.
 */
const NEXT_WEEK_UNLOCK = {
  /** 본가(운영): 토요일 10:00 KST */
  SATURDAY_10AM: { weekdayFromMon: 5, hour: 10, minute: 0 },
  /** 임시 테스트: 수요일 21:00 KST — 확인 후 ACTIVE_NEXT_WEEK_UNLOCK 을 SATURDAY_10AM 로 바꿀 것 */
  WEDNESDAY_9PM_TEST: { weekdayFromMon: 2, hour: 21, minute: 0 },
};

/** 테스트 끝나면 `NEXT_WEEK_UNLOCK.SATURDAY_10AM` 로 바꾸세요. */
const ACTIVE_NEXT_WEEK_UNLOCK = NEXT_WEEK_UNLOCK.WEDNESDAY_9PM_TEST;

/** 수업 예약 화면 잠금 토스트·카피 (ACTIVE_NEXT_WEEK_UNLOCK 과 동기화) */
export const NEXT_WEEK_LOCKED_TOAST_MESSAGE =
  ACTIVE_NEXT_WEEK_UNLOCK === NEXT_WEEK_UNLOCK.WEDNESDAY_9PM_TEST
    ? '다음 주 수업은 수요일 오후 9시(한국시간, 테스트)부터 신청 가능합니다.'
    : '다음 주 수업은 토요일 오전 10시(한국시간)부터 신청 가능합니다.';

/** 잠금 전체 화면 본문 (HTML 아님, 문장만) */
export const NEXT_WEEK_LOCKED_BANNER_HTML =
  ACTIVE_NEXT_WEEK_UNLOCK === NEXT_WEEK_UNLOCK.WEDNESDAY_9PM_TEST
    ? {
        lead: '다음 주 예약은 ',
        highlight: '매주 수요일 오후 9:00(한국시간·테스트)',
        trail: '부터 열리며, 확인 후 토요일 오전 10:00으로 복구 예정입니다.',
      }
    : {
        lead: '다음 주 예약은 ',
        highlight: '매주 토요일 오전 10:00(한국시간)',
        trail: '부터 열리며, 이후에도 계속 예약하실 수 있습니다.',
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

export function isNextWeekBookingUnlockedKST(anchor = new Date()) {
  const unlock = buildKstThisWeekUnlockInstant(anchor, ACTIVE_NEXT_WEEK_UNLOCK);
  return anchor.getTime() >= unlock.getTime();
}
