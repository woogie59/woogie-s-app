/**
 * LabDot week grid policy (admin export + time-block UI).
 * DB source of truth: trainer_settings.available_hours; these mirror Saturday rule for visuals.
 * JS: Date.getDay() 0=Sun … 5=Fri, 6=Sat
 */
export const SATURDAY_OPEN_HOUR = 13; // first bookable / displayed hour on Saturdays

export const DEFAULT_SLOT_START_HOUR = 10;
export const WEEKDAY_DEFAULT_END_HOUR = 23;
export const WEEKEND_DEFAULT_END_HOUR = 19;

export function normalizeTrainerHours(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => Number(x)).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))].sort(
    (a, b) => a - b
  );
}

/**
 * @param {Array<{ day_of_week: number, off?: boolean, available_hours?: unknown }>} settings
 * @param {number} dow — Date.getDay() 0=Sun … 6=Sat
 */
export function isDayOpen(settings, dow) {
  const row = (settings || []).find((s) => s.day_of_week === dow);
  if (!row || row.off) return false;
  return normalizeTrainerHours(row.available_hours).length > 0;
}

/** Whether a time-grid slot should be visually collapsed. */
export function isSlotFolded(date, expandEarly, expandLateWeekend, expandLateWeekday) {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const h = date.getHours();
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;
  if (!expandEarly && h < DEFAULT_SLOT_START_HOUR) return true;
  if (isWeekend) {
    if (!expandLateWeekend && h >= WEEKEND_DEFAULT_END_HOUR) return true;
  } else if (!expandLateWeekday && h >= WEEKDAY_DEFAULT_END_HOUR) {
    return true;
  }
  return false;
}

/**
 * @param {import('@fullcalendar/core').EventInput[]} events
 * @returns {{ needEarly: boolean, needLateWeekend: boolean, needLateWeekday: boolean }}
 */
export function detectHiddenEventSlots(events) {
  let needEarly = false;
  let needLateWeekend = false;
  let needLateWeekday = false;
  for (const ev of events || []) {
    const raw = ev.start;
    const start = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(start.getTime())) continue;
    const h = start.getHours();
    const dow = start.getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (h < DEFAULT_SLOT_START_HOUR) needEarly = true;
    if (isWeekend && h >= WEEKEND_DEFAULT_END_HOUR) needLateWeekend = true;
    else if (!isWeekend && h >= WEEKDAY_DEFAULT_END_HOUR) needLateWeekday = true;
    if (needEarly && needLateWeekend && needLateWeekday) break;
  }
  return { needEarly, needLateWeekend, needLateWeekday };
}

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

