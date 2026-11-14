/** Cancelled rows may be retained for audit. They are never active classes. */
export function isActiveBooking(row) {
  return Boolean(row) && row.status !== 'cancelled';
}
