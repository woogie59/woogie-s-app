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
 * Rolling time-lock: 이번 Mon–Sun 주의 **KST** 토요일 10:00 이후부터 "다음 주" 예약 탭이 열리고, 이후로 계속 열림(일요일에 닫지 않음).
 * 앵커 시각(브라우저)과 한국 토요일 10:00(고정 +09)을 직접 비교.
 */
export function isNextWeekBookingUnlockedKST(anchor = new Date()) {
  const ymd = kstDateKey(anchor);
  const [y, m, d] = ymd.split('-').map(Number);
  const ref = new Date(`${y}-${p2(m)}-${p2(d)}T12:00:00+09:00`);
  const dow = ref.getUTCDay();
  const offsetMon = dow === 0 ? 6 : dow - 1;
  const daysToSat = 5 - offsetMon;
  const satInstant = new Date(ref.getTime() + daysToSat * 86400000);
  const [ys, ms, ds] = kstDateKey(satInstant).split('-').map(Number);
  const unlock = new Date(`${ys}-${p2(ms)}-${p2(ds)}T10:00:00+09:00`);
  return anchor.getTime() >= unlock.getTime();
}
