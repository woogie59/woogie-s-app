// Shared helpers for session & pack calculations

import { toTime24h } from './cascadeAttendance';

/** Calendar YYYY-MM-DD in Asia/Seoul for an ISO timestamp (aligns with bookings.date). */
export function dateKeySeoulFromISO(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/**
 * Booking row counts as "this class was completed / 출석 반영" for pairing with attendance_logs.
 * Excludes cancelled / pending-only rows so deleted or never-held classes do not validate a log.
 */
export function isAttendanceBookingConsumed(status) {
  const n = normalizeBookingStatusForSession(status);
  if (n === 'cancelled' || n === 'canceled') return false;
  return n === 'completed' || n === 'attended' || n === 'checked-in';
}

/**
 * Count an attendance_logs row toward "used sessions" only if it matches a still-existing booking
 * that is completed/attended/checked-in (same calendar day + time). Orphans (zombie logs) are excluded.
 */
export function shouldCountAttendanceLog(log, bookings) {
  if (!log?.user_id || !Array.isArray(bookings)) return false;
  const logDate = dateKeySeoulFromISO(log.check_in_at);
  if (!logDate) return false;
  const logTime = toTime24h(log.session_time_fixed);
  const sameDay = bookings.filter(
    (b) =>
      b?.user_id === log.user_id &&
      String(b.date ?? '')
        .slice(0, 10)
        .trim() === logDate
  );
  if (sameDay.length === 0) return false;

  const consumed = (b) => isAttendanceBookingConsumed(b?.status);

  if (logTime) {
    return sameDay.some((b) => toTime24h(b.time) === logTime && consumed(b));
  }

  const consumedRows = sameDay.filter(consumed);
  if (consumedRows.length === 1) return true;
  if (consumedRows.length === 0) return false;

  const logMs = new Date(log.check_in_at).getTime();
  if (!Number.isFinite(logMs)) return false;
  return consumedRows.some((b) => {
    const parts = String(b.time || '').match(/(\d{1,2}):(\d{2})/);
    if (!parts) return false;
    const bh = parseInt(parts[1], 10);
    const bm = parseInt(parts[2], 10);
    const d = new Date(log.check_in_at);
    const lh = d.getHours();
    const lmin = d.getMinutes();
    const diff = Math.abs(lh * 60 + lmin - (bh * 60 + bm));
    return diff <= 180;
  });
}

export function countEligibleAttendanceLogs(logs, bookings) {
  if (!Array.isArray(logs)) return 0;
  return logs.filter((log) => shouldCountAttendanceLog(log, bookings)).length;
}

export const getRemainingSessions = (user) => {
  if (!user || !user.session_packs) return 0;
  return user.session_packs.reduce((acc, pack) => {
    return acc + (pack.total_count + pack.service_count - pack.used_count);
  }, 0);
};

export const getCurrentActivePack = (user) => {
  if (!user || !user.session_packs) return null;
  const activePacks = user.session_packs.filter((p) => p.total_count + p.service_count > p.used_count);
  return activePacks.length > 0 ? activePacks[0] : null;
};

export const formatDate = (date) => date.toISOString().split('T')[0];

/** Normalize booking status for comparison (lowercase, underscores → hyphens). */
export function normalizeBookingStatusForSession(status) {
  if (status == null || typeof status !== 'string') return '';
  return status.trim().toLowerCase().replace(/_/g, '-');
}

/**
 * A session is "used" for balance only when attended or checked-in (QR / admin mark).
 * Training reports alone do not consume a session.
 */
export function isBookingSessionConsumed(booking) {
  const n = normalizeBookingStatusForSession(booking?.status);
  return n === 'attended' || n === 'checked-in';
}

/** Count bookings that represent a consumed session (attended or checked-in). */
export function countUsedSessionsFromBookings(bookings) {
  if (!Array.isArray(bookings)) return 0;
  return bookings.filter(isBookingSessionConsumed).length;
}

/** Sum of purchased session counts across all packs for a member. */
export function sumTotalPurchasedFromBatches(batches) {
  if (!Array.isArray(batches)) return 0;
  return batches.reduce((sum, b) => sum + (Number(b.total_count) || 0), 0);
}

/** Remaining = total purchased − consumed sessions (eligible attendance_logs rows). */
export function computeRemainingSessions(totalPurchased, usedSessionCount) {
  return Math.max(0, (Number(totalPurchased) || 0) - (Number(usedSessionCount) || 0));
}

/**
 * Single source of truth for 잔여: sum(session_batches.total_count) − eligible attendance_logs count.
 * Pass supabase client + user id. Does not use profiles.remaining_sessions or batch.remaining_count.
 */
function groupByUserId(rows) {
  const m = {};
  if (!Array.isArray(rows)) return m;
  for (const row of rows) {
    const id = row?.user_id;
    if (!id) continue;
    if (!m[id]) m[id] = [];
    m[id].push(row);
  }
  return m;
}

/** Batch 잔여 (회원 목록용): userId → { remaining, totalPurchased, usedSessionCount } */
export async function fetchMembersBalanceSummaries(supabase, userIds) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  const empty = {};
  if (!supabase || ids.length === 0) return empty;

  const [batchesRes, logsRes, bookingsRes] = await Promise.all([
    supabase.from('session_batches').select('user_id, total_count').in('user_id', ids),
    supabase.from('attendance_logs').select('*').in('user_id', ids),
    supabase.from('bookings').select('*').in('user_id', ids),
  ]);

  const batchesByUser = groupByUserId(batchesRes.error ? [] : batchesRes.data);
  const logsByUser = groupByUserId(logsRes.error ? [] : logsRes.data);
  const bookingsByUser = groupByUserId(bookingsRes.error ? [] : bookingsRes.data);

  const result = {};
  for (const id of ids) {
    const tb = batchesByUser[id] || [];
    const tl = logsByUser[id] || [];
    const tbk = bookingsByUser[id] || [];
    const totalPurchased = sumTotalPurchasedFromBatches(tb);
    const usedSessionCount = countEligibleAttendanceLogs(tl, tbk);
    const remaining = computeRemainingSessions(totalPurchased, usedSessionCount);
    result[id] = { remaining, totalPurchased, usedSessionCount };
  }
  return result;
}

export async function fetchSessionBalanceMetrics(supabase, userId) {
  if (!userId || !supabase) {
    return {
      totalPurchased: 0,
      usedSessionCount: 0,
      remaining: 0,
      logs: [],
      bookings: [],
      batches: [],
    };
  }
  const [batchesRes, logsRes, bookingsRes] = await Promise.all([
    supabase.from('session_batches').select('total_count').eq('user_id', userId),
    supabase.from('attendance_logs').select('*').eq('user_id', userId),
    supabase.from('bookings').select('*').eq('user_id', userId),
  ]);
  const batches = batchesRes.error ? [] : batchesRes.data || [];
  const logs = logsRes.error ? [] : logsRes.data || [];
  const bookings = bookingsRes.error ? [] : bookingsRes.data || [];
  const totalPurchased = sumTotalPurchasedFromBatches(batches);
  const usedSessionCount = countEligibleAttendanceLogs(logs, bookings);
  const remaining = computeRemainingSessions(totalPurchased, usedSessionCount);
  return { totalPurchased, usedSessionCount, remaining, logs, bookings, batches };
}
