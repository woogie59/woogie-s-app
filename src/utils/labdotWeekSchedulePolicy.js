/**
 * LabDot schedule policy — trainer_settings is DB source of truth.
 * JS: Date.getDay() 0=Sun … 5=Fri, 6=Sat
 * 주말·휴일 수업 시작: 10:00~18:00
 */
export const DEFAULT_SLOT_START_HOUR = 10;
/** @deprecated 주말·휴일은 10시부터. 호환용 별칭 */
export const SATURDAY_OPEN_HOUR = DEFAULT_SLOT_START_HOUR;
export const WEEKDAY_PANEL_END_HOUR = 22;
export const WEEKDAY_LATE_HOUR = 23;
export const WEEKEND_PANEL_END_HOUR = 18;
export const WEEKEND_LATE_START_HOUR = 19;

/** 주말 당직 일괄 ON — 센터 10~19, 마지막 시작 18시 */
export const WEEKEND_BULK_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18];

/** 평일 프리셋 14~22 */
export const WEEKDAY_PRESET_14_22 = [14, 15, 16, 17, 18, 19, 20, 21, 22];

export function ymdFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function ymdKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return ymdFromDate(value);
  if (typeof value === 'object' && value.date) return String(value.date).slice(0, 10);
  return '';
}

function holidayDateSet(holidays) {
  const set = new Set();
  for (const h of holidays || []) {
    const y = ymdKey(h);
    if (y) set.add(y);
  }
  return set;
}

function openDateMap(openDates) {
  const map = new Map();
  for (const o of openDates || []) {
    const y = ymdKey(o);
    if (!y) continue;
    map.set(y, normalizeTrainerHours(o?.available_hours));
  }
  return map;
}

/**
 * 주말·휴일(이 날짜만 오픈) 기본 시간 — 10~18시 시작.
 */
export function defaultHoursForOpenDate(_settings, _ymd) {
  return [...WEEKEND_BULK_HOURS];
}

export function weeklyHoursForYmd(settings, ymd) {
  const dow = dayOfWeekFromYmd(ymd);
  const row = (settings || []).find((s) => s.day_of_week === dow);
  if (!row || row.off) return [];
  return normalizeTrainerHours(row.available_hours);
}

export function hoursEqual(a, b) {
  return normalizeTrainerHours(a).join(',') === normalizeTrainerHours(b).join(',');
}

/**
 * 특정 날짜 시간 토글의 시작점: 이미 날짜 예외가 있으면 그 시간, 휴무일이면 빈 배열, 아니면 주간 템플릿.
 */
export function seedHoursForDateOverride(settings, ymd, extras = {}) {
  const dateStr = ymdKey(ymd);
  if (!dateStr) return [];
  const opens = openDateMap(extras.openDates);
  if (opens.has(dateStr)) return opens.get(dateStr) || [];
  if (holidayDateSet(extras.holidays).has(dateStr)) return [];
  return weeklyHoursForYmd(settings, dateStr);
}

/**
 * 특정 날짜의 실제 오픈 여부. 우선순위: 이 날짜만 오픈 → 휴무일 → 주간 템플릿.
 * @returns {{ off: boolean, available_hours: number[], source: 'open_date' | 'holiday' | 'weekly' }}
 */
export function resolveDateAvailability(settings, ymd, extras = {}) {
  const dateStr = ymdKey(ymd);
  if (!dateStr) return { off: true, available_hours: [], source: 'weekly' };

  const opens = openDateMap(extras.openDates);
  if (opens.has(dateStr)) {
    const hours = opens.get(dateStr) || [];
    return { off: hours.length === 0, available_hours: hours, source: 'open_date' };
  }

  if (holidayDateSet(extras.holidays).has(dateStr)) {
    return { off: true, available_hours: [], source: 'holiday' };
  }

  const dow = dayOfWeekFromYmd(dateStr);
  const row = (settings || []).find((s) => s.day_of_week === dow);
  if (!row || row.off) return { off: true, available_hours: [], source: 'weekly' };
  const hours = normalizeTrainerHours(row.available_hours);
  return { off: hours.length === 0, available_hours: hours, source: 'weekly' };
}

export function isResolvedDateOpen(resolved) {
  return Boolean(resolved && !resolved.off && (resolved.available_hours || []).length > 0);
}

/**
 * @param {object} [extras]
 * @param {unknown[]} [extras.holidays]
 * @param {unknown[]} [extras.openDates]
 */
export function isTrainerHourAvailable(settings, date, extras = {}) {
  return getTrainerHourLaneState(settings, date, extras) === 'available';
}

/**
 * Calendar lane: weekly template vs this-date override.
 * @returns {'available' | 'weekly_off' | 'date_off' | 'holiday'}
 */
export function getTrainerHourLaneState(settings, date, extras = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'weekly_off';
  const ymd = ymdFromDate(date);
  const hour = date.getHours();
  const resolved = resolveDateAvailability(settings, ymd, extras);
  const weeklyOn = weeklyHoursForYmd(settings, ymd).includes(hour);

  if (resolved.source === 'holiday') return 'holiday';
  if (resolved.source === 'open_date') {
    if (!resolved.off && (resolved.available_hours || []).includes(hour)) return 'available';
    return weeklyOn ? 'date_off' : 'weekly_off';
  }
  if (resolved.off) return 'weekly_off';
  return (resolved.available_hours || []).includes(hour) ? 'available' : 'weekly_off';
}

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
