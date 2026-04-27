/**
 * PWA/새로고침: 커스텀 라우터 `view` 복원 (멤버가 수업 예약 화면에 머문 상태 유지).
 * Supabase `processAuth`의 기본 `replaceView(client_home)`과 별도로 sessionStorage+localStorage에 저장.
 */

const NS = 'labdot_v1';
export const PERSISTED_VIEW_KEY = (userId) => `${NS}_app_view_${String(userId)}`;

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

function readStorage(userId) {
  if (typeof window === 'undefined' || !userId) return null;
  const k = PERSISTED_VIEW_KEY(userId);
  let s = null;
  try {
    s = window.sessionStorage.getItem(k);
  } catch {
    /* ignore */
  }
  if (s) return s;
  try {
    s = window.localStorage.getItem(k);
  } catch {
    return null;
  }
  return s;
}

/**
 * @param {string} role 'admin' | else
 * @returns {string | null} 복원할 view, 없으면 null
 */
export function readPersistedView(userId, role) {
  const raw = readStorage(userId);
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  const isAdmin = role === 'admin';
  const allow = isAdmin ? ADMIN_VIEWS : CLIENT_VIEWS;
  if (!allow.has(v)) return null;
  if (!isAdmin && ADMIN_VIEWS.has(v) && !CLIENT_VIEWS.has(v)) return null;
  if (isAdmin && !ADMIN_VIEWS.has(v)) return null;
  return v;
}

export function writePersistedView(userId, view) {
  if (typeof window === 'undefined' || !userId || !view) return;
  const k = PERSISTED_VIEW_KEY(userId);
  const v = String(view);
  try {
    window.sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

export function clearPersistedView(userId) {
  if (typeof window === 'undefined' || !userId) return;
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
