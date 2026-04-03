/** @param {string} ymd */
export function formatKoreanDateFromYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return '—';
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * @param {{ session_focus?: string | null; workout_lines?: unknown }} row
 */
export function deriveSessionFocus(row) {
  const sf = row?.session_focus?.trim();
  if (sf) return sf;
  const lines = row?.workout_lines;
  if (Array.isArray(lines) && lines.length > 0) {
    const first = String(lines[0]);
    const m = first.match(/^\[(.+?)\]/);
    if (m) return `${m[1]} 세션`;
  }
  return '트레이닝 세션';
}

/**
 * Split a workout line into label + detail for display (best-effort).
 * @param {string} line
 */
export function parseWorkoutLineParts(line) {
  const s = String(line).trim();
  if (!s) return { label: '—', detail: '' };
  const parts = s.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { label: parts[0], detail: parts.slice(1).join(' · ') };
  }
  return { label: s, detail: '' };
}
