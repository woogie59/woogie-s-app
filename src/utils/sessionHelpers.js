// Shared helpers for session & pack calculations

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

/** Remaining = total purchased − consumed (attended / checked-in bookings). */
export function computeRemainingSessions(totalPurchased, usedSessionCount) {
  return Math.max(0, (Number(totalPurchased) || 0) - (Number(usedSessionCount) || 0));
}
