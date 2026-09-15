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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HTML_CELL_BASE =
  "border:1px solid #000000;padding:4px 6px;text-align:center;vertical-align:middle;font-family:'맑은 고딕',sans-serif;font-size:11pt;white-space:pre-wrap;";

/** HTML table — Google Sheets / Excel paste preserves borders + center alignment. */
export function ledgerAoaToHtmlTable(header, dataRows) {
  const aoa = [header, ...(dataRows || [])];
  if (!aoa.length) return '';

  const body = aoa
    .map((row, r) => {
      const bold = r === 0;
      const style = `${HTML_CELL_BASE}${bold ? 'font-weight:bold;' : ''}`;
      const cells = row
        .map((cell) => {
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

function buildCombinedPayrollClipboardHtml({ payrollHeader, payrollRows, salesHeader, salesRows }) {
  const parts = [];
  if (payrollRows?.length) {
    parts.push(ledgerAoaToHtmlTable(payrollHeader, payrollRows));
  }
  if (salesRows?.length) {
    if (parts.length) parts.push('<br/>');
    parts.push(ledgerAoaToHtmlTable(salesHeader, salesRows));
  }
  return parts.length ? wrapClipboardHtml(parts.join('')) : '';
}

/**
 * Copy payroll + sales ledger with bordered HTML (preferred) + TSV fallback.
 * @returns {Promise<{ ok: boolean, mode: 'html' | 'tsv' }>}
 */
export async function copyCombinedPayrollToClipboard({
  payrollHeader,
  payrollRows,
  salesHeader,
  salesRows,
}) {
  const tsv = buildCombinedPayrollClipboardText({
    payrollHeader,
    payrollRows,
    salesHeader,
    salesRows,
  });
  const html = buildCombinedPayrollClipboardHtml({
    payrollHeader,
    payrollRows,
    salesHeader,
    salesRows,
  });

  if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        }),
      ]);
      return { ok: true, mode: 'html' };
    } catch (err) {
      console.warn('[copyCombinedPayroll] ClipboardItem failed; falling back to TSV', err);
    }
  }

  await navigator.clipboard.writeText(tsv);
  return { ok: true, mode: 'tsv' };
}
