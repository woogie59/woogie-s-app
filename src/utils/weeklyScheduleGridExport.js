import * as XLSX from 'xlsx';
import { isSaturdayYmd, SATURDAY_OPEN_HOUR } from './labdotWeekSchedulePolicy.js';

const HOUR_START = 10;
const HOUR_END = 23;
const DOW = ['월', '화', '수', '목', '금', '토', '일'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Monday 00:00:00 of the week containing `d` (locale local), ISO week / KR habit */
export function getMonday(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const o = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + o);
  return x;
}

function parseTimeHour(timeRaw) {
  if (timeRaw == null || typeof timeRaw !== 'string') return null;
  const m = timeRaw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  if (h < 0 || h > 23) return null;
  return h;
}

/**
 * @param {Date} weekStart - First visible day of the week (e.g. FullCalendar activeStart, typically Monday 00:00)
 * @param {Date} weekEndExcl - exclusive end (e.g. FullCalendar activeEnd)
 * @param {Array<{ date?: string, time?: string, status?: string, profiles?: { name?: string } }>} bookings
 */
export function buildWeeklyTimetableMatrix(weekStart, weekEndExcl, bookings) {
  const dayKeys = [];
  const c = new Date(weekStart);
  c.setHours(0, 0, 0, 0);
  while (c < weekEndExcl) {
    dayKeys.push(toYmd(c));
    c.setDate(c.getDate() + 1);
  }
  const n = dayKeys.length; // 7 in week view
  if (n === 0) {
    return { headerRow: [], bodyRows: [], fileLabel: '' };
  }

  const fileLabel = `${toYmd(new Date(weekStart))}_~_${toYmd(new Date(weekEndExcl.getTime() - 86400000))}`;

  const headerRow = [
    '시간',
    ...dayKeys.map((k, i) => {
      const [y, mo, d] = k.split('-');
      return `${DOW[i] || ''}\n${mo}/${d}`;
    }),
  ];

  const cells = Array.from({ length: HOUR_END - HOUR_START + 1 }, () =>
    Array.from({ length: n }, () => []),
  );

  (bookings || []).forEach((b) => {
    if (!b) return;
    if ((b.status || '') === 'cancelled') return;
    const dk = b.date
      ? String(b.date).split('T')[0].slice(0, 10)
      : '';
    if (!dk) return;
    const col = dayKeys.indexOf(dk);
    if (col < 0) return;
    const h = parseTimeHour(b.time);
    if (h == null) return;
    if (h < HOUR_START || h > HOUR_END) return;
    const name = b.profiles?.name?.trim() || b.userName || '회원';
    const timeLabel = b.time && String(b.time).match(/^\d{1,2}:\d{2}/)
      ? b.time
      : `${pad2(h)}:00`;
    const line = `${name} (${timeLabel})`;
    const row = h - HOUR_START;
    cells[row][col].push(line);
  });

  const bodyRows = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    const row = [`${pad2(h)}:00`];
    for (let c = 0; c < n; c++) {
      const dk = dayKeys[c];
      const arr = cells[h - HOUR_START][c];
      let cell = arr.length ? arr.join('\n') : '';
      if (!cell && isSaturdayYmd(dk) && h < SATURDAY_OPEN_HOUR) {
        cell = '· 비가용(13:00~운영) ·';
      }
      row.push(cell);
    }
    bodyRows.push(row);
  }

  return { headerRow, bodyRows, fileLabel };
}

/**
 * @param {Date} weekStart
 * @param {Date} weekEndExcl
 * @param {Array} bookings
 */
export function downloadWeeklyScheduleXlsx(weekStart, weekEndExcl, bookings) {
  const { headerRow, bodyRows, fileLabel } = buildWeeklyTimetableMatrix(weekStart, weekEndExcl, bookings);
  if (!headerRow.length) return;

  const aoa = [headerRow, ...bodyRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colWidths = [{ wch: 8 }].concat(Array(Math.max(0, headerRow.length - 1)).fill({ wch: 20 }));
  ws['!cols'] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '주간일정');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const name = `주간_일정_${fileLabel || toYmd(weekStart)}.xlsx`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
