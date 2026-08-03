/** 스프레드시트 매출 등록 붙여넣기용 */
export const SALES_LEDGER_HEADER = [
  'no',
  '등록일',
  '회원명',
  '등록 횟수',
  '총 금액(vat제외)',
  '결제 금액(vat제외)',
  '미납 금액(vat제외)',
  '비고',
];

function formatRegistrationDate(createdAt) {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function formatPackLabel(totalCount) {
  const n = Number(totalCount) || 0;
  if (n <= 0) return '';
  return `pt ${n}회`;
}

function formatWonCurrency(value) {
  const n = Math.round(Number(value) || 0);
  return `₩${n.toLocaleString('ko-KR')}`;
}

function batchTotalAmount(batch) {
  const fromPrice = Number(batch?.price);
  if (Number.isFinite(fromPrice) && fromPrice > 0) return fromPrice;
  const tc = Number(batch?.total_count) || 0;
  const pps = Number(batch?.price_per_session) || 0;
  return tc * pps;
}

function salesAppliedMonthParts(batch) {
  const raw = batch?.sales_applied_month || batch?.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * @param {Array<{ id, name?, email? }>} members
 * @param {Array} sessionBatches
 * @param {number} selectedYear
 * @param {number} selectedMonth 1–12
 */
export function buildSalesLedgerRows(members, sessionBatches, selectedYear, selectedMonth) {
  const nameByUserId = {};
  for (const m of members || []) {
    if (m?.id) nameByUserId[m.id] = String(m.name || m.email || '—').trim();
  }

  const filtered = (sessionBatches || [])
    .filter((batch) => {
      const parts = salesAppliedMonthParts(batch);
      if (!parts) return false;
      return parts.year === selectedYear && parts.month === selectedMonth;
    })
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  return filtered.map((batch, idx) => {
    const totalAmount = batchTotalAmount(batch);
    const memberName = `${nameByUserId[batch.user_id] || '—'}님`;
    return [
      idx + 1,
      formatRegistrationDate(batch.created_at),
      memberName,
      formatPackLabel(batch.total_count),
      formatWonCurrency(totalAmount),
      formatWonCurrency(totalAmount),
      '₩0',
      '',
    ];
  });
}

export function ledgerAoaToTsv(header, dataRows) {
  const rows = [header, ...(dataRows || [])];
  return rows
    .map((row) =>
      row
        .map((cell) =>
          String(cell ?? '')
            .replace(/\t/g, ' ')
            .replace(/\r?\n/g, ' '),
        )
        .join('\t'),
    )
    .join('\n');
}

/** Payroll TSV + blank line + sales TSV (either section may be empty). */
export function buildCombinedPayrollClipboardText({
  payrollHeader,
  payrollRows,
  salesHeader,
  salesRows,
}) {
  const parts = [];
  if (payrollRows?.length) {
    parts.push(ledgerAoaToTsv(payrollHeader, payrollRows));
  }
  if (salesRows?.length) {
    if (parts.length) parts.push('');
    parts.push(ledgerAoaToTsv(salesHeader, salesRows));
  }
  return parts.join('\n');
}
