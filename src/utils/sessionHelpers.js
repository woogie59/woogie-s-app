// Shared helpers for session & pack calculations

/**
 * Single source of truth for "used sessions": rows in attendance_logs whose status is COMPLETED
 * (case-insensitive). Legacy rows without `status` count as completed check-ins.
 * Explicitly excluded: CANCELLED, VOID, INVALID, PENDING, etc.
 */
export function normalizeAttendanceLogStatus(status) {
  if (status == null || typeof status !== 'string') return '';
  return status.trim().toUpperCase().replace(/-/g, '_');
}

export function isAttendanceLogCompletedForBalance(log) {
  if (!log) return false;
  const raw = log.status;
  if (raw == null || String(raw).trim() === '') return true;
  const n = normalizeAttendanceLogStatus(raw);
  if (n === 'CANCELLED' || n === 'CANCELED' || n === 'VOID' || n === 'INVALID' || n === 'PENDING') {
    return false;
  }
  return n === 'COMPLETED';
}

/** Used session count = attendance_logs rows counted as completed (see isAttendanceLogCompletedForBalance). */
export function countCompletedAttendanceLogs(logs) {
  if (!Array.isArray(logs)) return 0;
  return logs.filter((log) => isAttendanceLogCompletedForBalance(log)).length;
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

/** Remaining = total purchased − completed attendance_logs count. */
export function computeRemainingSessions(totalPurchased, usedSessionCount) {
  return Math.max(0, (Number(totalPurchased) || 0) - (Number(usedSessionCount) || 0));
}

/**
 * 잔여: sum(session_batches.total_count) − count(attendance_logs with status COMPLETED).
 * Does not use profiles.remaining_sessions or session_batches.remaining_count.
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

  const [batchesRes, logsRes] = await Promise.all([
    supabase.from('session_batches').select('user_id, total_count').in('user_id', ids),
    supabase.from('attendance_logs').select('id, user_id, status, check_in_at').in('user_id', ids),
  ]);

  const batchesByUser = groupByUserId(batchesRes.error ? [] : batchesRes.data);
  const logsByUser = groupByUserId(logsRes.error ? [] : logsRes.data);

  const result = {};
  for (const id of ids) {
    const tb = batchesByUser[id] || [];
    const tl = logsByUser[id] || [];
    const totalPurchased = sumTotalPurchasedFromBatches(tb);
    const usedSessionCount = countCompletedAttendanceLogs(tl);
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
      batches: [],
    };
  }
  const [batchesRes, logsRes] = await Promise.all([
    supabase.from('session_batches').select('total_count').eq('user_id', userId),
    supabase.from('attendance_logs').select('*').eq('user_id', userId),
  ]);
  const batches = batchesRes.error ? [] : batchesRes.data || [];
  const logs = logsRes.error ? [] : logsRes.data || [];
  const totalPurchased = sumTotalPurchasedFromBatches(batches);
  const usedSessionCount = countCompletedAttendanceLogs(logs);
  const remaining = computeRemainingSessions(totalPurchased, usedSessionCount);
  return { totalPurchased, usedSessionCount, remaining, logs, batches };
}
