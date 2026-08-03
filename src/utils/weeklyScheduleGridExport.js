import * as XLSX from 'xlsx-js-style';

const HOUR_START = 10;
const HOUR_END = 23;
const DOW_LONG = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

const BLACK_BORDER = {
  top: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
};

const ALIGN = { horizontal: 'center', vertical: 'center', wrapText: true };

function baseStyle({ bold = false } = {}) {
  return {
    font: { name: '맑은 고딕', sz: 11, bold },
    alignment: ALIGN,
    border: BLACK_BORDER,
  };
}

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

function colToLetter(col0) {
  let n = col0 + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Summary row formulas — COUNTIF per day, SUM for weekly total (1-based Excel rows). */
function buildWeeklySummaryFormulas(aoaLength, numDayCols) {
  const slotRows = HOUR_END - HOUR_START + 1;
  const bodyFirstRow = 3;
  const bodyLastRow = bodyFirstRow + slotRows - 1;
  const summaryRowNum = aoaLength;

  const dayFormulas = [];
  for (let d = 0; d < numDayCols; d++) {
    const col = colToLetter(1 + d);
    dayFormulas.push(`=COUNTIF(${col}${bodyFirstRow}:${col}${bodyLastRow},"*수업*")`);
  }

  const firstDayCol = colToLetter(1);
  const lastDayCol = colToLetter(numDayCols);
  const weekFormula = `=SUM(${firstDayCol}${summaryRowNum}:${lastDayCol}${summaryRowNum})`;

  return ['합계', ...dayFormulas, weekFormula];
}

function formulaForSheetJs(formula) {
  return String(formula || '').startsWith('=') ? formula.slice(1) : formula;
}

function parseTimeHour(timeRaw) {
  if (timeRaw == null || typeof timeRaw !== 'string') return null;
  const m = timeRaw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  if (h < 0 || h > 23) return null;
  return h;
}

/** 1~5: Monday's calendar week of month. */
function weekOfMonthKorean(monday) {
  const d = monday.getDate();
  return Math.max(1, Math.ceil(d / 7));
}

/**
 * @param {Date} weekStart
 * @param {Date} weekEndExcl
 * @param {Array<{ date?: string, time?: string, status?: string, profiles?: { name?: string } }>} bookings
 * @returns {{
 *   title: string,
 *   headerRow: any[],
 *   bodyRows: any[][],
 *   summaryRow: any[],
 *   fileLabel: string,
 * }}
 */
export function buildWeeklyTimetableMatrix(weekStart, weekEndExcl, bookings) {
  const dayKeys = [];
  const c = new Date(weekStart);
  c.setHours(0, 0, 0, 0);
  while (c < weekEndExcl) {
    dayKeys.push(toYmd(c));
    c.setDate(c.getDate() + 1);
  }
  const n = dayKeys.length;
  if (n === 0) {
    return {
      title: '',
      headerRow: [],
      bodyRows: [],
      summaryRow: [],
      fileLabel: '',
    };
  }

  const fileLabel = `${toYmd(new Date(weekStart))}_~_${toYmd(new Date(weekEndExcl.getTime() - 86400000))}`;

  const m0 = new Date(weekStart);
  m0.setHours(0, 0, 0, 0);
  const monthNum = m0.getMonth() + 1;
  const weekNo = weekOfMonthKorean(m0);
  const title = `${monthNum}월 ${weekNo}째주 일정표`;

  const dayHeaderCells = dayKeys.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const M = d.getMonth() + 1;
    const D = d.getDate();
    const di = d.getDay();
    const dow = DOW_LONG[di === 0 ? 6 : di - 1];
    return `${M}월 ${D}일 ${dow}`;
  });

  const numCols = 1 + n + 1; // time + days + week total
  const headerRow = ['시간', ...dayHeaderCells, '주간'];

  const slotRows = HOUR_END - HOUR_START + 1; // 14
  const cells = Array.from({ length: slotRows }, () => Array.from({ length: n }, () => []));

  (bookings || []).forEach((b) => {
    if (!b) return;
    if ((b.status || '') === 'cancelled') return;
    const dk = b.date ? String(b.date).split('T')[0].slice(0, 10) : '';
    if (!dk) return;
    const col = dayKeys.indexOf(dk);
    if (col < 0) return;
    const h = parseTimeHour(b.time);
    if (h == null) return;
    if (h < HOUR_START || h > HOUR_END) return;
    const name = b.profiles?.name?.trim() || b.userName || '회원';
    const line = `${name}님 수업`;
    const row = h - HOUR_START;
    cells[row][col].push(line);
  });

  const bodyRows = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    const r = h - HOUR_START;
    const timeLabel = `${h}시`;
    const dataCols = dayKeys.map((_, c) => {
      const arr = cells[r][c];
      return arr.length ? arr.join('\n') : '';
    });
    bodyRows.push([timeLabel, ...dataCols, '']);
  }

  const perDayTotals = new Array(n).fill(0);
  for (let c = 0; c < n; c++) {
    let sum = 0;
    for (let r = 0; r < slotRows; r++) {
      sum += cells[r][c].length;
    }
    perDayTotals[c] = sum;
  }
  const weekGrand = perDayTotals.reduce((a, b) => a + b, 0);
  const summaryRow = ['합계', ...perDayTotals, weekGrand];

  return {
    title,
    headerRow,
    bodyRows,
    summaryRow,
    fileLabel,
  };
}

/** Title + header + grid + summary rows for Excel / clipboard. */
export function buildWeeklyTimetableAoa(weekStart, weekEndExcl, bookings) {
  const { title, headerRow, bodyRows, summaryRow, fileLabel } = buildWeeklyTimetableMatrix(
    weekStart,
    weekEndExcl,
    bookings,
  );
  if (!headerRow.length) return null;

  const numCols = headerRow.length;
  const titleRow = [title, ...Array(Math.max(0, numCols - 1)).fill('')];
  const aoa = [titleRow, headerRow, ...bodyRows, summaryRow];
  const numDayCols = numCols - 2;
  const summaryFormulas = buildWeeklySummaryFormulas(aoa.length, numDayCols);
  return {
    aoa,
    fileLabel,
    summaryFormulas,
  };
}

export function weeklyTimetableAoaToTsv(aoa, summaryFormulas) {
  return (aoa || [])
    .map((row, r) => {
      const isSummary = r === aoa.length - 1;
      return row
        .map((cell, c) => {
          const raw = isSummary && summaryFormulas?.[c] != null ? summaryFormulas[c] : cell;
          return String(raw ?? '')
            .replace(/\t/g, ' ')
            .replace(/\r?\n/g, ' ');
        })
        .join('\t');
    })
    .join('\n');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HTML_CELL_BASE =
  "border:1px solid #000000;padding:4px 6px;text-align:center;vertical-align:middle;font-family:'맑은 고딕',sans-serif;font-size:11pt;white-space:pre-wrap;";

/** HTML table with black cell borders — Excel/Sheets paste preserves grid lines. */
export function weeklyTimetableAoaToHtmlTable(aoa, summaryFormulas) {
  if (!aoa?.length) return '';

  const numCols = aoa[1]?.length ?? aoa[0].length;
  const lastIdx = aoa.length - 1;

  const body = aoa
    .map((row, r) => {
      const isTitle = r === 0;
      const isHeader = r === 1;
      const isSummary = r === lastIdx;
      const bold = isTitle || isHeader || isSummary;
      const style = `${HTML_CELL_BASE}${bold ? 'font-weight:bold;' : ''}`;

      if (isTitle) {
        return `<tr><td colspan="${numCols}" style="${style}">${escapeHtml(row[0])}</td></tr>`;
      }

      const cells = row
        .map((cell, c) => {
          const formula = isSummary ? summaryFormulas?.[c] : null;
          if (formula && String(formula).startsWith('=')) {
            const fmlaAttr = escapeHtml(formula).replace(/"/g, '&quot;');
            const sheetsFormula = fmlaAttr;
            return `<td x:fmla="${fmlaAttr}" data-sheets-formula="${sheetsFormula}" style="${style}">${escapeHtml(formula)}</td>`;
          }
          const text = escapeHtml(cell).replace(/\n/g, '<br/>');
          return `<td style="${style}">${text}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${body}</table>`;
}

function wrapClipboardHtml(fragment) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`;
}

/** Copy timetable with bordered HTML (preferred) + TSV plain-text fallback. */
export async function copyWeeklyScheduleAoaToClipboard(built) {
  const aoa = built?.aoa ?? built;
  const summaryFormulas = built?.summaryFormulas;
  const tsv = weeklyTimetableAoaToTsv(aoa, summaryFormulas);
  const html = wrapClipboardHtml(weeklyTimetableAoaToHtmlTable(aoa, summaryFormulas));

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        }),
      ]);
      return { ok: true, mode: 'html' };
    } catch (err) {
      console.warn('[copyWeeklySchedule] ClipboardItem failed; falling back to TSV', err);
    }
  }

  await navigator.clipboard.writeText(tsv);
  return { ok: true, mode: 'tsv' };
}

/**
 * @param {Date} weekStart
 * @param {Date} weekEndExcl
 * @param {Array} bookings
 */
export function downloadWeeklyScheduleXlsx(weekStart, weekEndExcl, bookings) {
  const built = buildWeeklyTimetableAoa(weekStart, weekEndExcl, bookings);
  if (!built) return;

  const { aoa, fileLabel, summaryFormulas } = built;
  const headerRow = aoa[1];
  const numCols = headerRow.length;
  const totalRows = aoa.length;
  const lastRow0 = totalRows - 1;

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }];

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow0, c: numCols - 1 },
  });

  ws['!cols'] = [
    { wch: 8 },
    ...Array(Math.max(0, numCols - 2))
      .fill(null)
      .map(() => ({ wch: 20 })),
    { wch: 10 },
  ];
  ws['!rows'] = aoa.map((_, r) => (r === 0 ? { hpt: 30 } : { hpt: 20 }));

  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      let cell = ws[addr];
      if (!cell) {
        cell = { t: 's', v: '' };
        ws[addr] = cell;
      }

      const isTitle = r === 0;
      const isHeader = r === 1;
      const isSummary = r === lastRow0;
      const bold = isTitle || isHeader || isSummary;

      if (isSummary && c >= 1) {
        const formula = summaryFormulas?.[c];
        if (formula && String(formula).startsWith('=')) {
          cell.t = 'n';
          cell.f = formulaForSheetJs(formula);
          const n = Number(aoa[lastRow0][c]);
          if (!Number.isNaN(n) && aoa[lastRow0][c] !== '') {
            cell.v = n;
          }
        } else {
          const n = Number(cell.v);
          if (!Number.isNaN(n) && cell.v !== '') {
            cell.t = 'n';
            cell.v = n;
          }
        }
      }

      cell.s = baseStyle({ bold });
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '주간일정');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', bookSST: false });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const name = `주간_일정_${fileLabel || toYmd(weekStart)}.xlsx`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
