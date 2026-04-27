/**
 * PWA/새로고침: 커스텀 라우터 `view` 복원 (멤버가 수업 예약 화면에 머문 상태 유지).
 * **localStorage 먼저** 읽기 — iOS/안드로이드 PWA 백그라운드에서 sessionStorage가 비는 경우에도 복원.
 * Supabase `processAuth`의 `INITIAL_SESSION`과 함께 `lastVisitedPath` 백업도 사용.
 */

const NS = 'labdot_v1';
export const PERSISTED_VIEW_KEY = (userId) => `${NS}_app_view_${String(userId)}`;
/** e.g. `/booking` + userId; mirrors `view` for bulletproof PWA restore */
export const PWA_KEY_LAST_VISITED_PATH = 'lastVisitedPath';

const CLIENT_VIEWS = new Set([
  'client_home',
  'class_booking',
  'training_log',
  'training_log_detail',
  'library',
  'library_article',
  'macro_calculator',
]);

const ADMIN_VIEWS = new Set([
  'admin_home',
  'admin_settings',
  'admin_schedule',
  'admin_payroll',
  'member_list',
  'member_detail',
  'scanner',
  'revenue',
  'library',
  'library_article',
  'training_log',
  'training_log_detail',
  'class_booking',
]);

/**
 * PWA: sessionStorage may be cleared or empty after suspend — prefer durable localStorage.
 * @param {string} k key
 * @returns {string | null}
 */
function readWithLocalFirst(k) {
  if (typeof window === 'undefined') return null;
  let s = null;
  try {
    s = window.localStorage.getItem(k);
  } catch {
    /* ignore */
  }
  if (s) return s;
  try {
    s = window.sessionStorage.getItem(k);
  } catch {
    return null;
  }
  return s;
}

function readStorage(userId) {
  if (typeof window === 'undefined' || !userId) return null;
  const k = PERSISTED_VIEW_KEY(userId);
  return readWithLocalFirst(k);
}

const PATH_TO_CLIENT_VIEW = {
  '/': 'client_home',
  '/home': 'client_home',
  '/booking': 'class_booking',
  '/training': 'training_log',
  '/library': 'library',
  '/calculator': 'macro_calculator',
};

const PATH_TO_ADMIN_VIEW = {
  '/': 'admin_home',
  '/home': 'admin_home',
  '/admin': 'admin_home',
  '/booking': 'class_booking',
  '/schedule': 'admin_schedule',
  '/members': 'member_list',
  '/scanner': 'scanner',
  '/revenue': 'revenue',
  '/settings': 'admin_settings',
  '/payroll': 'admin_payroll',
};

/**
 * @param {string} path
 * @param {string | null} role
 * @returns {string | null} view
 */
function viewFromPath(path, role) {
  if (!path || typeof path !== 'string') return null;
  const p = path.trim() || '/home';
  const isAdmin = role === 'admin';
  const map = isAdmin ? PATH_TO_ADMIN_VIEW : PATH_TO_CLIENT_VIEW;
  const v = map[p] ?? null;
  if (!v) return null;
  const allow = isAdmin ? ADMIN_VIEWS : CLIENT_VIEWS;
  if (!allow.has(v)) return null;
  if (!isAdmin && ADMIN_VIEWS.has(v) && !CLIENT_VIEWS.has(v)) return null;
  if (isAdmin && !ADMIN_VIEWS.has(v)) return null;
  return v;
}

const VIEW_TO_PATH_CLIENT = {
  client_home: '/home',
  class_booking: '/booking',
  training_log: '/training',
  training_log_detail: '/training',
  library: '/library',
  library_article: '/library',
  macro_calculator: '/calculator',
};

const VIEW_TO_PATH_ADMIN = {
  admin_home: '/admin',
  admin_settings: '/settings',
  admin_schedule: '/schedule',
  admin_payroll: '/payroll',
  member_list: '/members',
  member_detail: '/members',
  scanner: '/scanner',
  revenue: '/revenue',
  library: '/library',
  library_article: '/library',
  training_log: '/training',
  training_log_detail: '/training',
  class_booking: '/booking',
};

/**
 * @param {string} view
 * @param {boolean} isAdmin
 * @returns {string} path
 */
function pathFromView(view, isAdmin) {
  const m = isAdmin ? VIEW_TO_PATH_ADMIN : VIEW_TO_PATH_CLIENT;
  return m[view] ?? (isAdmin ? '/admin' : '/home');
}

/**
 * @param {string} userId
 * @param {string} view
 * @param {boolean} [isAdmin] from profiles.role
 */
export function writePwaLastVisitedPath(userId, view, isAdmin) {
  if (typeof window === 'undefined' || !userId || !view) return;
  const path = pathFromView(view, Boolean(isAdmin));
  try {
    window.localStorage.setItem(
      PWA_KEY_LAST_VISITED_PATH,
      JSON.stringify({ userId: String(userId), path }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} userId
 * @param {string | null} role profiles.role; only `'admin'` is treated as admin
 * @returns {string | null} view
 */
function readPwaLastVisitedView(userId, role) {
  if (typeof window === 'undefined' || !userId) return null;
  let raw;
  try {
    raw = window.localStorage.getItem(PWA_KEY_LAST_VISITED_PATH);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'string') return null;
  let o;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || o.userId !== String(userId) || !o.path) return null;
  return viewFromPath(String(o.path), role);
}

/**
 * @param {string} userId
 * @param {string | null} role
 * @returns {string | null} 복원할 view, 없으면 null
 */
export function readPersistedView(userId, role) {
  const raw = readStorage(userId);
  if (raw && typeof raw === 'string') {
    const v = raw.trim();
    if (v) {
      const isAdmin = role === 'admin';
      const allow = isAdmin ? ADMIN_VIEWS : CLIENT_VIEWS;
      if (allow.has(v)) {
        if (!isAdmin && ADMIN_VIEWS.has(v) && !CLIENT_VIEWS.has(v)) {
          // fall through to lastVisitedPath
        } else if (isAdmin && !ADMIN_VIEWS.has(v)) {
          // fall through
        } else {
          return v;
        }
      }
    }
  }
  const fromPath = readPwaLastVisitedView(userId, role);
  if (fromPath) return fromPath;
  return null;
}

export function writePersistedView(userId, view) {
  if (typeof window === 'undefined' || !userId || !view) return;
  const k = PERSISTED_VIEW_KEY(userId);
  const v = String(view);
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} userId
 */
export function clearPwaLastVisitedPath(userId) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const raw = window.localStorage.getItem(PWA_KEY_LAST_VISITED_PATH);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (o && o.userId === String(userId)) {
      window.localStorage.removeItem(PWA_KEY_LAST_VISITED_PATH);
    }
  } catch {
    /* ignore */
  }
}

export function clearPersistedView(userId) {
  if (typeof window === 'undefined' || !userId) return;
  clearPwaLastVisitedPath(userId);
  const k = PERSISTED_VIEW_KEY(userId);
  try {
    window.sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
