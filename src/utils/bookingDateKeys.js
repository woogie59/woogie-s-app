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

/** QR/체크인용: 로컬·KST 둘 다 후보 (타임존 불일치로 빈 조회 방지) */
export function todayDateKeysForBookingMatch() {
  return [...new Set([localCalendarDateKey(), kstDateKey()])];
}
