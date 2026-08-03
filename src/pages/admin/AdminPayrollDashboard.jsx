import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ClipboardCopy } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { supabase } from '../../lib/supabaseClient';
import BackButton from '../../components/ui/BackButton';
import { useGlobalModal } from '../../context/GlobalModalContext';
import { isAttendanceLogCompletedForBalance } from '../../utils/sessionHelpers';
import {
  batchPackBalance,
  buildAssignmentByLogIdForUsers,
  buildPriceByLogIdForUsers,
  countMonthConductedByBatchId,
  countTotalConductedByBatchId,
  monthStatsFromLogs,
  resolveLogUnitPriceWon,
  sumResolvedLogPrices,
} from '../../utils/payrollPricing';
import {
  buildCombinedPayrollClipboardText,
  buildSalesLedgerRows,
  SALES_LEDGER_HEADER,
} from '../../utils/payrollSalesExport';

/** Local calendar month bounds for `check_in_at` (timestamptz): 1st 00:00:00.000 — last day 23:59:59.999. */
function monthRangeISO(dateInMonth) {
  const y = dateInMonth.getFullYear();
  const m = dateInMonth.getMonth();
  const firstDay = new Date(y, m, 1, 0, 0, 0, 0).toISOString();
  const lastDay = new Date(y, m + 1, 0, 23, 59, 59, 999).toISOString();
  return { firstDay, lastDay };
}

function startOfCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Last 12 calendar months ending at the current month (newest first). */
function buildLastTwelveMonthOptions() {
  const rows = [];
  const base = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    rows.push({
      value: `${y}-${String(mo).padStart(2, '0')}`,
      label: `${y}년 ${String(mo).padStart(2, '0')}월`,
    });
  }
  return rows;
}

function formatDateOnly(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function normalizeSessionTime(t) {
  if (!t || typeof t !== 'string') return '—';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return t.trim();
}

function sessionTimeFromCheckIn(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Approximate end time (+60m) for CSV when only start is known */
function addMinutesToHhMm(hhmm, addMin = 60) {
  const m = String(hhmm).match(/(\d{1,2}):(\d{2})/);
  if (!m) return '—';
  let h = parseInt(m[1], 10);
  let min = parseInt(m[2], 10) + addMin;
  h += Math.floor(min / 60);
  min %= 60;
  h %= 24;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const BLACK_BORDER = {
  top: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
};

const ALIGN = { horizontal: 'center', vertical: 'center', wrapText: true };

function baseCellStyle({ bold = false } = {}) {
  return {
    font: { name: '맑은 고딕', sz: 11, bold },
    alignment: ALIGN,
    border: BLACK_BORDER,
  };
}

function applyAttendanceExportStyles(ws, headerRow0, nCols, nRows) {
  if (!nCols || !nRows) return;
  const lastR = headerRow0 + nRows - 1;
  for (let r = headerRow0; r <= lastR; r++) {
    for (let c = 0; c < nCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] || { t: 's', v: '' };
      ws[addr] = cell;
      if (typeof cell.v === 'number' && Number.isFinite(cell.v)) cell.t = 'n';
      else cell.t = 's';
      cell.s = baseCellStyle({ bold: r === headerRow0 });
    }
  }
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: headerRow0, c: 0 },
    e: { r: lastR, c: nCols - 1 },
  });
  const colW = [6, 14, 10, 12, 10, 12, 10, 10, 10, 12];
  ws['!cols'] = Array.from({ length: nCols }, (_, i) => ({ wch: colW[i] ?? 12 }));
  ws['!rows'] = Array.from({ length: nRows }, (_, i) => (i === 0 ? { hpt: 22 } : { hpt: 20 }));
}

/** Per-user sum of `session_batches.remaining_count` (pack rows). */
function sumRemainingCountByUser(rows) {
  const m = {};
  for (const row of rows || []) {
    const uid = row?.user_id;
    if (!uid) continue;
    m[uid] = (m[uid] || 0) + (Number(row?.remaining_count) || 0);
  }
  return m;
}

/** Per-user sum of `session_batches.total_count` (등록 세션수). */
function sumTotalCountByUser(rows) {
  const m = {};
  for (const row of rows || []) {
    const uid = row?.user_id;
    if (!uid) continue;
    m[uid] = (m[uid] || 0) + (Number(row?.total_count) || 0);
  }
  return m;
}

function formatWonKo(value) {
  if (value == null || !Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('ko-KR');
}

/** 급여표 `판매공제 단가` — 40,000 / 60,000 (콤마, 원 미포함) */
function formatPayrollUnitPriceCell(value) {
  if (value == null || !Number.isFinite(value) || value <= 0) return '';
  return Math.round(value).toLocaleString('ko-KR');
}

function formatUnitPriceLabel(stats) {
  if (!stats?.count) return { unitLabel: '단가 미정', monthPayout: null };
  if (stats.prices.size === 0) return { unitLabel: '단가 미정', monthPayout: stats.sum };
  if (stats.prices.size === 1) {
    return { unitLabel: `${formatWonKo([...stats.prices][0])}원`, monthPayout: stats.sum };
  }
  return { unitLabel: '회원권별 상이', monthPayout: stats.sum };
}

/** 스프레드시트 급여표 붙여넣기용 (재등록·수업료·합계는 시트에서 입력/자동계산) */
const PAYROLL_LEDGER_HEADER = [
  'no',
  '회원명',
  '재등록',
  '등록 세션수',
  '잔여세션',
  '판매공제 단가',
  '수업료',
  '진행 수업',
  '잔여 수업',
  '합계',
];

function buildPayrollBatchRow(member, batch, conductedInMonth, allUserLogs, assignmentByLogId) {
  const totalConductedByBatch = countTotalConductedByBatchId(allUserLogs, assignmentByLogId);
  const lifetimeConducted = totalConductedByBatch[batch.id] || 0;
  const { registered, remaining } = batchPackBalance(batch, lifetimeConducted);
  const remainingAtMonthStart = remaining + conductedInMonth;
  const unitPriceWon = Math.round(Number(batch.price_per_session) || 0);
  const baseName = String(member?.name || member?.email || '—').trim();

  return [
    `${baseName}님`,
    '',
    registered,
    remainingAtMonthStart,
    formatPayrollUnitPriceCell(unitPriceWon),
    '',
    conductedInMonth,
    remaining,
    '',
  ];
}

function buildPayrollFallbackRow(member, uid, conductedInMonth, ctx) {
  const {
    batchesByUserId,
    allLogsByUserId,
    logsByUserId,
    priceByLogId,
    profilePriceByUserId,
    assignmentByLogId,
  } = ctx;
  const baseName = String(member?.name || member?.email || '—').trim();
  const allUserLogs = allLogsByUserId[uid] || [];
  const monthLogs = logsByUserId[uid] || [];
  const totalPurchased = (batchesByUserId[uid] || []).reduce(
    (sum, b) => sum + (Number(b.total_count) || 0),
    0,
  );
  const lifetimeConducted = countTotalConductedByBatchId(allUserLogs, assignmentByLogId);
  const totalUsed = Object.values(lifetimeConducted).reduce((s, n) => s + n, 0);
  const remaining =
    totalPurchased > 0
      ? Math.max(0, totalPurchased - totalUsed)
      : Math.max(
          0,
          totalPurchased - allUserLogs.filter(isAttendanceLogCompletedForBalance).length,
        );
  const remainingAtMonthStart = remaining + conductedInMonth;
  const monthStats = monthStatsFromLogs(monthLogs, priceByLogId, profilePriceByUserId);
  const unitPriceWon =
    monthStats.count > 0
      ? Math.round(monthStats.sum / monthStats.count)
      : Math.round(Number(profilePriceByUserId[uid]) || 0);

  return [
    `${baseName}님`,
    '',
    totalPurchased || '',
    remainingAtMonthStart,
    formatPayrollUnitPriceCell(unitPriceWon),
    '',
    conductedInMonth,
    remaining,
    '',
  ];
}

function buildPayrollLedgerRows(
  members,
  {
    batchesByUserId,
    completedCountByUser,
    logsByUserId,
    allLogsByUserId,
    priceByLogId,
    profilePriceByUserId,
    assignmentByLogId,
  },
) {
  const sortedMembers = [...(members || [])].sort((a, b) => {
    const na = (a?.name || a?.email || '').localeCompare(b?.name || b?.email || '', 'ko');
    return na;
  });

  const rawRows = [];

  for (const m of sortedMembers) {
    const uid = m.id;
    const completedInMonth = Number(completedCountByUser[uid] ?? 0);
    if (completedInMonth <= 0) continue;

    const batches = [...(batchesByUserId[uid] || [])].sort(
      (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
    );
    const monthLogs = logsByUserId[uid] || [];
    const allUserLogs = allLogsByUserId[uid] || [];
    const monthConductedByBatch = countMonthConductedByBatchId(
      monthLogs,
      assignmentByLogId,
      batches,
    );

    const activeBatches = batches.filter((b) => (monthConductedByBatch[b.id] || 0) > 0);
    const ctx = {
      batchesByUserId,
      logsByUserId,
      allLogsByUserId,
      priceByLogId,
      profilePriceByUserId,
      assignmentByLogId,
    };

    if (activeBatches.length > 0) {
      for (const batch of activeBatches) {
        const conductedInMonth = monthConductedByBatch[batch.id] || 0;
        rawRows.push(
          buildPayrollBatchRow(
            m,
            batch,
            conductedInMonth,
            allUserLogs,
            assignmentByLogId,
          ),
        );
      }

      const assignedInMonth = activeBatches.reduce(
        (sum, b) => sum + (monthConductedByBatch[b.id] || 0),
        0,
      );
      const unassignedInMonth = completedInMonth - assignedInMonth;
      if (unassignedInMonth > 0) {
        rawRows.push(buildPayrollFallbackRow(m, uid, unassignedInMonth, ctx));
      }
    } else {
      rawRows.push(buildPayrollFallbackRow(m, uid, completedInMonth, ctx));
    }
  }

  const dataRows = rawRows.map((row, idx) => [idx + 1, ...row]);
  return { header: PAYROLL_LEDGER_HEADER, dataRows };
}

function buildPayrollExportBundle(members, sessionBatches, payrollCtx, selectedDate) {
  const payroll = buildPayrollLedgerRows(members, payrollCtx);
  const salesRows = buildSalesLedgerRows(
    members,
    sessionBatches,
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
  );
  return { payroll, salesRows };
}

const AdminPayrollDashboard = ({ goBack }) => {
  const { showToast } = useGlobalModal();
  const [selectedDate, setSelectedDate] = useState(() => startOfCurrentMonth());

  const monthOptions = useMemo(() => buildLastTwelveMonthOptions(), []);

  const { firstDay, lastDay } = useMemo(() => monthRangeISO(selectedDate), [selectedDate]);

  const monthLabel = useMemo(() => {
    const y = selectedDate.getFullYear();
    const mo = selectedDate.getMonth() + 1;
    return `${y}년 ${String(mo).padStart(2, '0')}월`;
  }, [selectedDate]);

  const monthSelectValue = useMemo(() => {
    const y = selectedDate.getFullYear();
    const mo = selectedDate.getMonth() + 1;
    return `${y}-${String(mo).padStart(2, '0')}`;
  }, [selectedDate]);

  const handleMonthSelectChange = useCallback((e) => {
    const v = e.target.value;
    if (!v || typeof v !== 'string') return;
    const [ys, ms] = v.split('-');
    const y = parseInt(ys, 10);
    const mo = parseInt(ms, 10);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return;
    setSelectedDate(new Date(y, mo - 1, 1));
  }, []);

  const [members, setMembers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [allCompletedLogs, setAllCompletedLogs] = useState([]);
  const [sessionBatches, setSessionBatches] = useState([]);
  const [remainingByUser, setRemainingByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: profileRows, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, email, price_per_session')
        .neq('role', 'admin')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (pErr) throw pErr;

      const memberIds = (profileRows || []).map((p) => p.id).filter(Boolean);

      const [{ data: logRows, error: lErr }, { data: batchRows, error: bErr }, { data: allLogRows, error: allErr }] =
        await Promise.all([
        supabase
          .from('attendance_logs')
          .select('*')
          .gte('check_in_at', firstDay)
          .lte('check_in_at', lastDay)
          .order('check_in_at', { ascending: false }),
        memberIds.length
          ? supabase
              .from('session_batches')
              .select(
                'id, user_id, remaining_count, price_per_session, total_count, created_at, price, sales_applied_month',
              )
              .in('user_id', memberIds)
          : Promise.resolve({ data: [], error: null }),
        memberIds.length
          ? supabase
              .from('attendance_logs')
              .select('id, user_id, check_in_at, session_price_snapshot, status')
              .in('user_id', memberIds)
              .order('check_in_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (lErr) throw lErr;
      if (allErr) {
        console.warn('[AdminPayrollDashboard] all attendance_logs', allErr.message);
        setAllCompletedLogs([]);
      } else {
        setAllCompletedLogs(allLogRows || []);
      }
      if (bErr) {
        console.warn('[AdminPayrollDashboard] session_batches', bErr.message);
        setRemainingByUser({});
        setSessionBatches([]);
      } else {
        setRemainingByUser(sumRemainingCountByUser(batchRows));
        setSessionBatches(batchRows || []);
      }

      setMembers(profileRows || []);
      setLogs(logRows || []);
      setSelectedId((prev) => {
        if (prev && (profileRows || []).some((p) => p.id === prev)) return prev;
        return profileRows?.[0]?.id ?? null;
      });
    } catch (e) {
      console.error('[AdminPayrollDashboard]', e);
      setError(e?.message || 'Failed to load data.');
      setMembers([]);
      setLogs([]);
      setAllCompletedLogs([]);
      setSessionBatches([]);
      setRemainingByUser({});
    } finally {
      setLoading(false);
    }
  }, [firstDay, lastDay]);

  useEffect(() => {
    load();
  }, [load]);

  const nameByUserId = useMemo(() => {
    const m = {};
    (members || []).forEach((p) => {
      if (p?.id) m[p.id] = p.name || p.email || '—';
    });
    return m;
  }, [members]);

  const completedCountByUser = useMemo(() => {
    const map = {};
    (logs || []).forEach((row) => {
      if (!isAttendanceLogCompletedForBalance(row)) return;
      const uid = row?.user_id;
      if (!uid) return;
      map[uid] = (map[uid] || 0) + 1;
    });
    return map;
  }, [logs]);

  const batchesByUserId = useMemo(() => {
    const m = {};
    for (const row of sessionBatches || []) {
      const uid = row?.user_id;
      if (!uid) continue;
      if (!m[uid]) m[uid] = [];
      m[uid].push(row);
    }
    return m;
  }, [sessionBatches]);

  const profilePriceByUserId = useMemo(() => {
    const m = {};
    for (const p of members || []) {
      if (p?.id) m[p.id] = p.price_per_session;
    }
    return m;
  }, [members]);

  const priceByLogId = useMemo(
    () => buildPriceByLogIdForUsers(allCompletedLogs, batchesByUserId),
    [allCompletedLogs, batchesByUserId],
  );

  const assignmentByLogId = useMemo(
    () => buildAssignmentByLogIdForUsers(allCompletedLogs, batchesByUserId),
    [allCompletedLogs, batchesByUserId],
  );

  const logsByUserId = useMemo(() => {
    const m = {};
    for (const row of logs || []) {
      const uid = row?.user_id;
      if (!uid) continue;
      if (!m[uid]) m[uid] = [];
      m[uid].push(row);
    }
    return m;
  }, [logs]);

  const allLogsByUserId = useMemo(() => {
    const m = {};
    for (const row of allCompletedLogs || []) {
      const uid = row?.user_id;
      if (!uid) continue;
      if (!m[uid]) m[uid] = [];
      m[uid].push(row);
    }
    return m;
  }, [allCompletedLogs]);

  const monthStatsByUser = useMemo(() => {
    const m = {};
    for (const p of members || []) {
      if (!p?.id) continue;
      m[p.id] = monthStatsFromLogs(
        logsByUserId[p.id] || [],
        priceByLogId,
        profilePriceByUserId,
      );
    }
    return m;
  }, [members, logsByUserId, priceByLogId, profilePriceByUserId]);

  const totalRegisteredByUser = useMemo(() => sumTotalCountByUser(sessionBatches), [sessionBatches]);

  const filteredLogs = useMemo(() => {
    if (!selectedId) return [];
    return (logs || []).filter(
      (l) => l.user_id === selectedId && isAttendanceLogCompletedForBalance(l),
    );
  }, [logs, selectedId]);

  const payrollLedgerContext = useMemo(
    () => ({
      batchesByUserId,
      completedCountByUser,
      logsByUserId,
      allLogsByUserId,
      priceByLogId,
      profilePriceByUserId,
      assignmentByLogId,
    }),
    [
      batchesByUserId,
      completedCountByUser,
      logsByUserId,
      allLogsByUserId,
      priceByLogId,
      profilePriceByUserId,
      assignmentByLogId,
    ],
  );

  const selectedMemberMonthTotal = useMemo(() => {
    if (!selectedId) return null;
    return sumResolvedLogPrices(
      filteredLogs,
      priceByLogId,
      profilePriceByUserId,
    );
  }, [selectedId, filteredLogs, priceByLogId, profilePriceByUserId]);

  const handleExportExcel = () => {
    const { payroll, salesRows } = buildPayrollExportBundle(
      members,
      sessionBatches,
      payrollLedgerContext,
      selectedDate,
    );
    if (!payroll.dataRows.length && !salesRows.length) {
      showToast('이번 달 페이롤·매출 데이터가 없습니다.');
      return;
    }

    const wb = XLSX.utils.book_new();

    if (payroll.dataRows.length) {
      const aoa = [payroll.header, ...payroll.dataRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      applyAttendanceExportStyles(ws, 0, payroll.header.length, 1 + payroll.dataRows.length);
      XLSX.utils.book_append_sheet(wb, ws, '수업');
    }

    if (salesRows.length) {
      const salesAoa = [SALES_LEDGER_HEADER, ...salesRows];
      const salesWs = XLSX.utils.aoa_to_sheet(salesAoa);
      applyAttendanceExportStyles(salesWs, 0, SALES_LEDGER_HEADER.length, 1 + salesRows.length);
      XLSX.utils.book_append_sheet(wb, salesWs, '매출');
    }

    const safeMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
    XLSX.writeFile(wb, `payroll-${safeMonth}.xlsx`);
  };

  const handleCopyToClipboard = async () => {
    const { payroll, salesRows } = buildPayrollExportBundle(
      members,
      sessionBatches,
      payrollLedgerContext,
      selectedDate,
    );
    if (!payroll.dataRows.length && !salesRows.length) {
      showToast('이번 달 페이롤·매출 데이터가 없습니다.');
      return;
    }

    const tsvContent = buildCombinedPayrollClipboardText({
      payrollHeader: payroll.header,
      payrollRows: payroll.dataRows,
      salesHeader: SALES_LEDGER_HEADER,
      salesRows,
    });

    try {
      await navigator.clipboard.writeText(tsvContent);
      showToast('급여·매출 데이터가 복사되었습니다. 필요한 구간만 붙여넣기(Cmd+V) 하세요.');
    } catch (err) {
      console.error('Failed to copy payroll TSV:', err);
      showToast('클립보드 복사에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white text-neutral-950 font-sans">
      <header className="border-b border-neutral-200 px-6 py-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <BackButton onClick={goBack} />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-950">Payroll · Attendance</h1>
            <p className="mt-2 text-sm text-neutral-500 font-normal tracking-wide">
              월간 출석 및 정산 리포트 — {monthLabel}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:shrink-0">
            <label className="inline-flex flex-wrap items-center gap-2.5 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 shadow-sm sm:min-h-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400 whitespace-nowrap">
                조회 연월
              </span>
              <div className="relative min-w-[10.5rem]">
                <select
                  value={monthSelectValue}
                  onChange={handleMonthSelectChange}
                  className="bg-transparent border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-emerald-600/25 focus:border-emerald-600 block w-full pl-3 pr-9 py-2.5 cursor-pointer appearance-none outline-none"
                  aria-label="조회할 연도와 월 선택"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-500"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyToClipboard}
                disabled={loading || !(members || []).length}
                className="inline-flex shrink-0 items-center gap-2 border border-neutral-200 bg-white text-neutral-900 px-5 py-3 text-sm font-medium tracking-wide hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ClipboardCopy className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                급여 복사하기
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={loading || !(members || []).length}
                className="shrink-0 border border-neutral-900 bg-neutral-900 text-white px-5 py-3 text-sm font-medium tracking-wide hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                엑셀 다운로드
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {error && (
          <p className="text-sm text-red-700 border border-red-200 bg-red-50/50 px-4 py-3 mb-8" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-neutral-400 tracking-wide">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            <aside className="lg:col-span-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-6">Members</h2>
              <ul className="divide-y divide-neutral-200 border-t border-b border-neutral-200">
                {(members || []).map((m) => {
                  const active = m.id === selectedId;
                  const n = completedCountByUser[m.id] ?? 0;
                  const rem = remainingByUser[m.id] ?? 0;
                  const { unitLabel, monthPayout } = formatUnitPriceLabel(monthStatsByUser[m.id]);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(m.id)}
                        className={`w-full text-left py-4 px-1 transition-colors ${
                          active ? 'bg-neutral-50' : 'hover:bg-neutral-50/60'
                        }`}
                      >
                        <span className={`block text-sm font-medium ${active ? 'text-neutral-950' : 'text-neutral-800'}`}>
                          {m.name || '—'}
                        </span>
                        <span className="block text-xs text-neutral-500 mt-1 font-normal tabular-nums">
                          출석 {n}회 · 잔여 {rem}회
                        </span>
                        <span className="block text-[11px] text-neutral-500 mt-1 font-normal tabular-nums leading-snug">
                          {monthPayout == null ? (
                            <>단가 {unitLabel} · 월 정산 —</>
                          ) : (
                            <>
                              단가 {unitLabel} · 월 정산 {formatWonKo(monthPayout)}원
                            </>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <section className="lg:col-span-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-6">Attendance log</h2>
              {!selectedId ? (
                <p className="text-sm text-neutral-500">Select a member.</p>
              ) : filteredLogs.length === 0 ? (
                <p className="text-sm text-neutral-500 border border-neutral-200 px-4 py-8">
                  No attendance records in this month for this member.
                </p>
              ) : (
                <div className="overflow-x-auto border border-neutral-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50/80">
                        <th className="py-3 px-3 font-semibold text-neutral-900 whitespace-nowrap">Date</th>
                        <th className="py-3 px-3 font-semibold text-neutral-900 whitespace-nowrap">Session time</th>
                        <th className="py-3 px-3 font-semibold text-neutral-900 whitespace-nowrap">Status</th>
                        <th className="py-3 px-3 font-semibold text-neutral-900 whitespace-nowrap">Check-in</th>
                        <th className="py-3 px-3 font-semibold text-neutral-900 whitespace-nowrap text-right">단가(원)</th>
                        <th className="py-3 px-3 font-semibold text-neutral-900 whitespace-nowrap text-right">월 총정산(원)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => {
                        const unit = resolveLogUnitPriceWon(
                          log,
                          priceByLogId,
                          profilePriceByUserId[selectedId],
                        );
                        return (
                          <tr key={log.id} className="border-b border-neutral-100 last:border-0">
                            <td className="py-3 px-3 text-neutral-800 tabular-nums whitespace-nowrap">
                              {formatDateOnly(log.check_in_at)}
                            </td>
                            <td className="py-3 px-3 text-neutral-800 tabular-nums whitespace-nowrap">
                              {normalizeSessionTime(log.session_time_fixed) || sessionTimeFromCheckIn(log.check_in_at)}
                            </td>
                            <td className="py-3 px-3 text-neutral-800 whitespace-nowrap">Completed</td>
                            <td className="py-3 px-3 text-neutral-600 tabular-nums whitespace-nowrap text-xs">
                              {formatDateTime(log.check_in_at)}
                            </td>
                            <td className="py-3 px-3 text-neutral-700 tabular-nums whitespace-nowrap text-right text-xs">
                              {unit == null ? '단가 미정' : `${formatWonKo(unit)}`}
                            </td>
                            <td className="py-3 px-3 text-neutral-700 tabular-nums whitespace-nowrap text-right text-xs">
                              —
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {filteredLogs.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-neutral-200 bg-neutral-50/80">
                          <td colSpan={5} className="py-3 px-3 text-right text-xs font-semibold text-neutral-600">
                            월 총정산
                          </td>
                          <td className="py-3 px-3 text-neutral-900 tabular-nums whitespace-nowrap text-right text-xs font-semibold">
                            {selectedMemberMonthTotal == null
                              ? '—'
                              : `${formatWonKo(selectedMemberMonthTotal)}`}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPayrollDashboard;
