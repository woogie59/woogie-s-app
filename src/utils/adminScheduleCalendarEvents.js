/**
 * Map merged schedule items (App.jsx mergedItemsByDate) → FullCalendar EventInput.
 * Session block length: 50 minutes (LabDot PT).
 */
const SESSION_MS = 50 * 60 * 1000;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseTimeToHm(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/**
 * @param {Record<string, Array<{ booking?: object, time?: string, userName?: string, status?: string }>>} mergedItemsByDate
 * @returns {import('@fullcalendar/core').EventInput[]}
 */
export function buildAdminCalendarEvents(mergedItemsByDate) {
  const out = [];
  if (!mergedItemsByDate || typeof mergedItemsByDate !== 'object') return out;

  Object.entries(mergedItemsByDate).forEach(([dateKey, items]) => {
    (items || []).forEach((item) => {
      const b = item.booking;
      if (!b?.id) return;
      if (b.status === 'cancelled') return;
      const parts = parseTimeToHm(item.time);
      if (!parts) return;
      const start = new Date(
        `${dateKey}T${pad2(parts.h)}:${pad2(parts.m)}:00`
      );
      if (Number.isNaN(start.getTime())) return;
      const end = new Date(start.getTime() + SESSION_MS);
      const done = item.status === 'Completed';
      out.push({
        id: String(b.id),
        title: item.userName || b.profiles?.name || '회원',
        start,
        end,
        classNames: done ? ['labdot-session-done'] : ['labdot-session-scheduled'],
        extendedProps: { item, dateKey },
      });
    });
  });
  return out;
}

/**
 * @param {Array<{ id: string, block_date?: string, date?: string, block_time?: string, time?: string, label?: string }>} blocks
 * @returns {import('@fullcalendar/core').EventInput[]}
 */
export function buildBlockedCalendarEvents(blocks) {
  const out = [];
  (blocks || []).forEach((row) => {
    const dateKey = String(row.block_date ?? row.date ?? '');
    const timeRaw = row.block_time ?? row.time;
    const parts = parseTimeToHm(timeRaw);
    if (!dateKey || !parts) return;
    const start = new Date(`${dateKey}T${pad2(parts.h)}:${pad2(parts.m)}:00`);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + SESSION_MS);
    out.push({
      id: `block-${row.id}`,
      title: row.label || '예약처리',
      start,
      end,
      classNames: ['labdot-slot-blocked'],
      extendedProps: { isBlock: true, block: row, dateKey },
    });
  });
  return out;
}
