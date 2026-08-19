import { supabase } from '../lib/supabaseClient';

/** 예약 시작 + 1시간 경과분 자동 완료 (best-effort). */
export async function runAutoCompleteDueBookings() {
  const { data, error } = await supabase.rpc('auto_complete_due_bookings');
  if (error) {
    console.warn('[runAutoCompleteDueBookings]', error.message);
    return { ok: false, error };
  }
  return { ok: true, data };
}
