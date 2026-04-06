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
