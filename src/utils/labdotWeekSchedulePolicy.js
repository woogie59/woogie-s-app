/**
 * LabDot schedule policy — trainer_settings is DB source of truth.
 * JS: Date.getDay() 0=Sun … 5=Fri, 6=Sat
 */
export const SATURDAY_OPEN_HOUR = 13;

export const DEFAULT_SLOT_START_HOUR = 10;
export const WEEKDAY_PANEL_END_HOUR = 22;
export const WEEKDAY_LATE_HOUR = 23;
export const WEEKEND_PANEL_END_HOUR = 18;
export const WEEKEND_LATE_START_HOUR = 19;

/** 주말 당직 일괄 ON — 센터 10~19, 마지막 시작 18시 */
export const WEEKEND_BULK_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18];

/** 평일 프리셋 14~22 */
export const WEEKDAY_PRESET_14_22 = [14, 15, 16, 17, 18, 19, 20, 21, 22];

export function isWeekendDow(dow) {
  return dow === 0 || dow === 6;
}

export function hoursInRange(start, end) {
  const s = Math.max(0, Math.min(23, start));
  const e = Math.max(0, Math.min(23, end));
  if (e < s) return [];
  return Array.from({ length: e - s + 1 }, (_, i) => s + i);
}

/**
 * 예약 설정 패널에 표시할 시간 칸
 * @param {number} dow
 * @param {boolean} expandEarly — 00~09
 * @param {boolean} expandLate — 주말 19~23 / 평일 23
 */
export function visiblePanelHours(dow, expandEarly, expandLate) {
  const isWe = isWeekendDow(dow);
  const start = expandEarly ? 0 : DEFAULT_SLOT_START_HOUR;
  let end = isWe ? WEEKEND_PANEL_END_HOUR : WEEKDAY_PANEL_END_HOUR;
  if (expandLate) end = 23;
  return hoursInRange(start, end);
}

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
 * @param {number} dow
 */
export function isDayOpen(settings, dow) {
  const row = (settings || []).find((s) => s.day_of_week === dow);
  if (!row || row.off) return false;
  return normalizeTrainerHours(row.available_hours).length > 0;
}

/** 주말 10~18 전부 ON 상태인지 (당직 일괄 스위치 표시용) */
export function isWeekendBulkActive(day) {
  if (!day || day.off) return false;
  const hours = normalizeTrainerHours(day.available_hours);
  return WEEKEND_BULK_HOURS.every((h) => hours.includes(h));
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

/**
 * 설정에 숨겨진 구간의 active hour가 있으면 expand 토글 자동 ON
 * @returns {{ weekdayEarly: boolean, weekdayLate: boolean, weekendEarly: boolean, weekendLate: boolean }}
 */
export function detectPanelExpandNeeds(settings) {
  const out = { weekdayEarly: false, weekdayLate: false, weekendEarly: false, weekendLate: false };
  for (const row of settings || []) {
    const isWe = isWeekendDow(row.day_of_week);
    for (const h of normalizeTrainerHours(row.available_hours)) {
      if (h < DEFAULT_SLOT_START_HOUR) {
        if (isWe) out.weekendEarly = true;
        else out.weekdayEarly = true;
      }
      if (isWe && h > WEEKEND_PANEL_END_HOUR) out.weekendLate = true;
      if (!isWe && h > WEEKDAY_PANEL_END_HOUR) out.weekdayLate = true;
    }
  }
  return out;
}
