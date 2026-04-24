/**
 * LabDot week grid policy (admin export + time-block UI).
 * DB source of truth: trainer_settings.available_hours; these mirror Saturday rule for visuals.
 * JS: Date.getDay() 0=Sun … 5=Fri, 6=Sat
 */
export const SATURDAY_OPEN_HOUR = 13; // first bookable / displayed hour on Saturdays

/**
 * @param {string} ymd
 * @returns {number} getDay() 0–6
 */
export function dayOfWeekFromYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return -1;
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  return d.getDay();
}

/** @param {string} ymd @returns {boolean} */
export function isSaturdayYmd(ymd) {
  return dayOfWeekFromYmd(ymd) === 6;
}

