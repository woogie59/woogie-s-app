/**
 * PWA 수업 예약: **localStorage 우선** 복원(모바일 PWA 백그라운드에서 sessionStorage 유실) +
 * `?date=&week=` URL 동기(새로고침/공유) + `selectedDate` 키 미러.
 */
import { isNextWeekBookingUnlockedKST } from './bookingDateKeys';

export const PWA_KEY_SELECTED_DATE = 'selectedDate';

const URL_DATE = 'date';
const URL_WEEK = 'week';

export function keyBookingSelectedDate(userId) {
  return userId ? `booking_selected_date_${String(userId)}` : 'booking_selected_date';
}

export function keyBookingWeekMode(userId) {
  return userId ? `booking_week_mode_${String(userId)}` : 'booking_week_mode';
}

function getMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toYmd(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function weekDateKeysForMode(weekMode) {
  const now = new Date();
  const thisMonday = getMonday(now);
  const nextMonday = addDays(thisMonday, 7);
  const active = weekMode === 'next' ? nextMonday : thisMonday;
  return Array.from({ length: 7 }, (_, i) => toYmd(addDays(active, i)));
}

/** local calendar day as ISO (noon) — example 요구: toISOString 보관용 */
function ymdToIsoStorage(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

function parseStoredDateToYmd(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return toYmd(new Date(t));
}

/**
 * localStorage 먼저(모바일 PWA) → sessionStorage → `selectedDate` 미러 → URL;
 * (mount 시 default 오늘 대신 저장값 우선)
 */
function readBookingPwaFromStorages(userId) {
  if (typeof window === 'undefined' || !userId) {
    return { ymd: null, week: null };
  }
  let rawDate = null;
  let rawWeek = null;
  try {
    rawDate = window.localStorage.getItem(keyBookingSelectedDate(userId));
    rawWeek = window.localStorage.getItem(keyBookingWeekMode(userId));
  } catch {
    /* ignore */
  }
  if (!rawDate) {
    try {
      rawDate = window.sessionStorage.getItem(keyBookingSelectedDate(userId));
    } catch {
      /* ignore */
    }
  }
  if (!rawWeek) {
    try {
      rawWeek = window.sessionStorage.getItem(keyBookingWeekMode(userId));
    } catch {
      /* ignore */
    }
  }
  if (!rawDate) {
    try {
      const s = window.localStorage.getItem(PWA_KEY_SELECTED_DATE);
      if (s) {
        const o = JSON.parse(s);
        if (o && o.userId === String(userId) && typeof o.ymd === 'string' && o.ymd) {
          rawDate = o.ymd;
        }
      }
    } catch {
      /* ignore */
    }
  }
  const week = rawWeek === 'next' ? 'next' : rawWeek === 'current' ? 'current' : null;
  const ymd = parseStoredDateToYmd(rawDate);
  return { ymd, week };
}

function readFromUrl() {
  if (typeof window === 'undefined') return { ymd: null, week: null };
  const p = new URLSearchParams(window.location.search);
  const d = p.get(URL_DATE);
  const w = p.get(URL_WEEK);
  const ymd = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  const week = w === 'next' || w === 'current' ? w : null;
  return { ymd, week };
}

function validate({ ymd, weekMode }) {
  const todayKey = toYmd(new Date());
  let w = weekMode === 'next' ? 'next' : 'current';
  if (w === 'next' && !isNextWeekBookingUnlockedKST(new Date())) {
    w = 'current';
  }
  const keys = weekDateKeysForMode(w);
  let s = ymd;
  if (s && (s < todayKey || !keys.includes(s))) {
    s = null;
  }
  return { selectedDate: s, weekMode: w };
}

/**
 * localStorage/밀러 키 **우선**, 그다음 URL.
 */
export function getBookingInitialPwaState(userId) {
  const a = readBookingPwaFromStorages(userId);
  const b = readFromUrl();
  const ymd = a.ymd ?? b.ymd;
  const week = a.week ?? b.week ?? 'current';
  return validate({ ymd, weekMode: week });
}

export function writeBookingPwaToSessionAndUrl(userId, { selectedDate, weekMode }) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    if (selectedDate) {
      const iso = ymdToIsoStorage(selectedDate);
      if (iso) {
        window.localStorage.setItem(keyBookingSelectedDate(userId), iso);
      }
    } else {
      window.localStorage.removeItem(keyBookingSelectedDate(userId));
    }
    window.localStorage.setItem(keyBookingWeekMode(userId), weekMode === 'next' ? 'next' : 'current');
    try {
      window.localStorage.setItem(
        PWA_KEY_SELECTED_DATE,
        JSON.stringify({ userId: String(userId), ymd: selectedDate || null }),
      );
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
  try {
    if (selectedDate) {
      const iso = ymdToIsoStorage(selectedDate);
      if (iso) {
        window.sessionStorage.setItem(keyBookingSelectedDate(userId), iso);
      }
    } else {
      window.sessionStorage.removeItem(keyBookingSelectedDate(userId));
    }
    window.sessionStorage.setItem(keyBookingWeekMode(userId), weekMode === 'next' ? 'next' : 'current');
  } catch {
    /* ignore */
  }
  try {
    const u = new URL(window.location.href);
    if (selectedDate) {
      u.searchParams.set(URL_DATE, selectedDate);
    } else {
      u.searchParams.delete(URL_DATE);
    }
    u.searchParams.set(URL_WEEK, weekMode === 'next' ? 'next' : 'current');
    window.history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch {
    /* ignore */
  }
}

export function stripBookingPwaFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has(URL_DATE) && !u.searchParams.has(URL_WEEK)) return;
    u.searchParams.delete(URL_DATE);
    u.searchParams.delete(URL_WEEK);
    const next = u.pathname + (u.search ? u.search : '') + u.hash;
    window.history.replaceState(null, '', next);
  } catch {
    /* ignore */
  }
}

export function clearBookingPwaState(userId) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.sessionStorage.removeItem(keyBookingSelectedDate(userId));
    window.sessionStorage.removeItem(keyBookingWeekMode(userId));
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(keyBookingSelectedDate(userId));
    window.localStorage.removeItem(keyBookingWeekMode(userId));
  } catch {
    /* ignore */
  }
  try {
    const raw = window.localStorage.getItem(PWA_KEY_SELECTED_DATE);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && o.userId === String(userId)) {
        window.localStorage.removeItem(PWA_KEY_SELECTED_DATE);
      }
    }
  } catch {
    /* ignore */
  }
  stripBookingPwaFromUrl();
}
