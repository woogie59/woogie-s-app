/** Cross-screen refresh when attendance/bookings/batches change (member + admin lists stay in sync). */
export const SESSION_BALANCE_REFRESH_EVENT = 'labdot:session-balance-refresh';

export function emitSessionBalanceRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_BALANCE_REFRESH_EVENT));
  }
}
