const key = (uid) => `labdot_workout_view_v1_${uid}`;
const ymd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
export function readWorkoutViewState(uid, today) {
  try {
    const s = JSON.parse(localStorage.getItem(key(uid)) || 'null');
    if (!uid || !s || !Number.isFinite(s.savedAt) || s.savedAt > Date.now() || Date.now() - s.savedAt > 7 * 86400000 || !ymd(s.selected) || s.selected > today || !/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month) || s.month > today.slice(0, 7)) return null;
    return { month: s.month, selected: s.selected, scroll: Number.isFinite(s.scroll) ? Math.max(0, Math.min(s.scroll, 100000)) : 0 };
  } catch { return null; }
}
export function writeWorkoutViewState(uid, state) {
  if (!uid) return;
  try { localStorage.setItem(key(uid), JSON.stringify({ month: state.month, selected: state.selected, scroll: state.scroll, savedAt: Date.now() })); } catch { /* storage may be unavailable */ }
}
export function clearWorkoutViewState(uid) { try { if (uid) localStorage.removeItem(key(uid)); } catch { /* no-op */ } }
export function isSameUserAuthResume(previousUid, nextUid, event) {
  return Boolean(previousUid && previousUid === nextUid && ['SIGNED_IN', 'TOKEN_REFRESHED'].includes(event));
}
