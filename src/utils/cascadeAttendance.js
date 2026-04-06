/** bookings.time / attendance_logs.session_time_fixed 공통 정규화 (HH:mm) */
export function toTime24h(t) {
  if (!t || typeof t !== 'string') return '';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return String(t).trim();
}

/** booking.date (TEXT 또는 YYYY-MM-DD) → 해당 UTC 일의 check_in_at 범위 */
export function bookingDateToUtcRangeISO(dateStr) {
  const clean = String(dateStr).slice(0, 10);
  const parts = clean.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, mo, d] = parts;
  return {
    start: new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0)).toISOString(),
    end: new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999)).toISOString(),
  };
}

/**
 * 예약 삭제 시 좀비 출석 로그 제거: 같은 user, 같은 수업일(check_in_at), 같은 session_time_fixed.
 * 반드시 .select()로 삭제된 행을 반환받음 (0건이어도 에러 아님).
 */
export async function deleteAttendanceLogsForBooking(supabase, booking) {
  const userId = booking?.user_id;
  const range = bookingDateToUtcRangeISO(booking?.date);
  const timeNorm = toTime24h(booking?.time);
  if (!userId || !range) return { data: [], error: null };

  let q = supabase
    .from('attendance_logs')
    .delete()
    .eq('user_id', userId)
    .gte('check_in_at', range.start)
    .lte('check_in_at', range.end);

  if (timeNorm) q = q.eq('session_time_fixed', timeNorm);

  const { data, error } = await q.select();
  return { data: data ?? [], error };
}
