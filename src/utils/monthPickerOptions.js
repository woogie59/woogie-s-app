/** Month picker options: `{ value: 'YYYY-MM', label: 'YYYY년 MM월' }`, newest first. */
export function buildMonthPickerOptions({ monthsBack = 36, monthsForward = 3 } = {}) {
  const rows = [];
  const now = new Date();
  const startOffset = -monthsBack;
  const endOffset = monthsForward;
  for (let i = endOffset; i >= startOffset; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    rows.push({
      value: `${y}-${String(mo).padStart(2, '0')}`,
      label: `${y}년 ${String(mo).padStart(2, '0')}월`,
    });
  }
  return rows;
}

export function currentMonthPickerValue(date = new Date()) {
  const y = date.getFullYear();
  const mo = date.getMonth() + 1;
  return `${y}-${String(mo).padStart(2, '0')}`;
}

/** `YYYY-MM` → `YYYY-MM-01` for Postgres date column. */
export function monthPickerValueToDate(monthValue) {
  if (!monthValue || typeof monthValue !== 'string') return null;
  const [ys, ms] = monthValue.split('-');
  const y = parseInt(ys, 10);
  const mo = parseInt(ms, 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  return `${y}-${String(mo).padStart(2, '0')}-01`;
}

/** Postgres date / ISO → `YYYY-MM` for picker. */
export function dateToMonthPickerValue(iso) {
  if (!iso) return currentMonthPickerValue();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return currentMonthPickerValue();
  return currentMonthPickerValue(d);
}
