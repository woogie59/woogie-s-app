import { stripBracketPrefix } from './workoutPresets';

/** @param {string} ymd */
export function formatKoreanDateFromYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return '—';
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * Normalize DB workout line (string legacy or structured object) to one display line.
 * @param {unknown} line
 */
export function workoutLineToDisplayString(line) {
  if (line == null) return '';
  if (typeof line === 'string') return line.trim();
  if (typeof line === 'object' && line !== null) {
    const o = line;
    const focus = (o.focus ?? o.body_part ?? '').toString().trim();
    const name = stripBracketPrefix((o.exercise ?? o.name ?? '').toString().trim()) || '—';
    const w = o.weight_kg ?? o.weight;
    const reps = o.reps;
    const sets = o.sets;
    const prefix = focus ? `[${focus}] ${name}` : name;
    const bits = [];
    if (w !== '' && w != null && Number.isFinite(Number(w))) bits.push(`${Number(w)}kg`);
    if (reps !== '' && reps != null && Number.isFinite(Number(reps))) bits.push(`${Number(reps)}회`);
    if (sets !== '' && sets != null && Number.isFinite(Number(sets))) bits.push(`${Number(sets)}세트`);
    if (bits.length) return `${prefix} — ${bits.join(' · ')}`;
    return prefix;
  }
  return String(line).trim();
}

/**
 * @param {{ session_focus?: string | null; workout_lines?: unknown }} row
 */
export function deriveSessionFocus(row) {
  const sf = row?.session_focus?.trim();
  if (sf) return sf;
  const lines = row?.workout_lines;
  if (Array.isArray(lines) && lines.length > 0) {
    const first = lines[0];
    if (typeof first === 'object' && first !== null) {
      const f = (first.focus ?? first.body_part ?? '').toString().trim();
      if (f) return `${f} 세션`;
    }
    const s = workoutLineToDisplayString(first);
    const m = s.match(/^\[(.+?)\]/);
    if (m) return `${m[1]} 세션`;
  }
  return '트레이닝 세션';
}

/**
 * Split a workout line into label + detail for display (best-effort).
 * @param {string} line
 */
export function parseWorkoutLineParts(line) {
  if (line != null && typeof line === 'object') {
    const s = workoutLineToDisplayString(line);
    return parseWorkoutLineParts(s);
  }
  const s = String(line).trim();
    if (!s) return { label: '—', detail: '' };
  const parts = s.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { label: parts[0], detail: parts.slice(1).join(' · ') };
  }
  return { label: s, detail: '' };
}
