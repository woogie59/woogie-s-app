const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function formatHourLabel(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

export function normalizeBlockTime(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
}

/** Next calendar date (YYYY-MM-DD) for day_of_week 0=Sun … 6=Sat, including today if matches. */
export function nextDateForDayOfWeek(dayOfWeek, from = new Date()) {
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  const current = base.getDay();
  let diff = dayOfWeek - current;
  if (diff < 0) diff += 7;
  base.setDate(base.getDate() + diff);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayName(dow) {
  return DAY_NAMES[dow] ?? '?';
}

export function isSlotBlocked(blocks, dateStr, time) {
  const t = normalizeBlockTime(time);
  if (!dateStr || !t) return false;
  return (blocks || []).some(
    (row) => String(row.block_date ?? row.date) === dateStr && normalizeBlockTime(row.block_time ?? row.time) === t
  );
}
