import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import { FileSpreadsheet } from 'lucide-react';

const ICON_STROKE = 1.5;

/** Status values that count as a conducted (완료) class — normalized to lowercase with hyphens. */
const CONDUCTED_STATUS_NORMALIZED = new Set(['attended', 'completed', 'checked-in']);

/**
 * Local calendar month as YYYY-MM-DD bounds (no UTC shift for `bookings.date` DATE column).
 * `month1to12` is 1–12.
 */
function monthBoundsLocalCalendar(year, month1to12) {
  const y = Number(year);
  const m = Number(month1to12);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function normalizeBookingStatus(status) {
  if (status == null || typeof status !== 'string') return '';
  return status.trim().toLowerCase().replace(/_/g, '-');
}

function isConductedStatus(status) {
  return CONDUCTED_STATUS_NORMALIZED.has(normalizeBookingStatus(status));
}

/**
 * If true, only bookings that also have a training log (`client_session_reports`) for the same member + calendar day count.
 * Keep false to match broadly by booking status only (recommended when 일지 is not always filed).
 */
const REQUIRE_MATCHING_TRAINING_LOG = false;

/**
 * Monthly payroll Excel: member → count of conducted classes (bookings), not 일지 rows only.
 */
export default function AdminPayrollExport({ compact = false }) {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const { showAlert, showToast } = useGlobalModal();

  const years = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => y - i);
  }, [now]);

  const handleExport = async () => {
    setBusy(true);
    try {
      const { start, end } = monthBoundsLocalCalendar(year, month);

      const { data: bookingRows, error: bookingErr } = await supabase
        .from('bookings')
        .select('id, user_id, date, time, status')
        .gte('date', start)
        .lte('date', end)
        .limit(10000);

      if (bookingErr) throw bookingErr;

      const rawList = Array.isArray(bookingRows) ? bookingRows : [];
      const rawCount = rawList.length;

      let conductedList = rawList.filter((b) => isConductedStatus(b?.status));

      let reportKeySet = null;
      if (REQUIRE_MATCHING_TRAINING_LOG && conductedList.length > 0) {
        const { data: reportRows, error: reportErr } = await supabase
          .from('client_session_reports')
          .select('user_id, report_date')
          .gte('report_date', start)
          .lte('report_date', end)
          .limit(20000);
        if (reportErr) throw reportErr;
        reportKeySet = new Set(
          (Array.isArray(reportRows) ? reportRows : []).map((r) => `${r.user_id}|${r.report_date}`)
        );
        conductedList = conductedList.filter((b) => reportKeySet.has(`${b.user_id}|${b.date}`));
      }

      const afterConductedCount = conductedList.length;

      console.log('[AdminPayrollExport] bookings in month (raw, before conducted filter):', rawCount);
      console.log(
        '[AdminPayrollExport] after conducted criteria:',
        afterConductedCount,
        REQUIRE_MATCHING_TRAINING_LOG ? '(status + training log on same day)' : '(status: attended / completed / checked-in)'
      );
      if (rawCount > 0 && afterConductedCount === 0) {
        const distinctStatuses = [...new Set(rawList.map((b) => b?.status).filter(Boolean))];
        console.log('[AdminPayrollExport] distinct booking status values this month (why none matched?):', distinctStatuses);
      }

      const counts = new Map();
      for (const b of conductedList) {
        const uid = b.user_id;
        if (!uid) continue;
        counts.set(uid, (counts.get(uid) || 0) + 1);
      }

      const ids = [...counts.keys()];
      let namesById = new Map();
      if (ids.length > 0) {
        const { data: profs, error: pe } = await supabase.from('profiles').select('id, name').in('id', ids);
        if (pe) throw pe;
        namesById = new Map((profs || []).map((p) => [p.id, p.name?.trim() || '']));
      }

      const sheetRows = ids
        .map((id) => ({
          회원명: namesById.get(id) || '—',
          진행수업: counts.get(id) || 0,
        }))
        .sort((a, b) => String(a.회원명).localeCompare(String(b.회원명), 'ko'));

      if (sheetRows.length === 0) {
        showAlert({ message: '선택한 달에 완료 처리된 수업이 없습니다.' });
        return;
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

      const tag = `${year}-${String(month).padStart(2, '0')}`;
      const filename = `${tag}_Payroll_Woogie.xlsx`;
      XLSX.writeFile(wb, filename);

      showToast(`${sheetRows.length}명 · ${filename}`);
    } catch (e) {
      console.error('[AdminPayrollExport]', e);
      showAlert({ message: '내보내기 실패: ' + (e?.message || '') });
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <>
      {!compact && (
        <>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">월간 페이롤 정산</h2>
          <p className="text-xs text-gray-500 font-light leading-relaxed mt-1.5 mb-5">
            선택한 달의 예약 중 완료·출석·체크인 처리된 수업 건수를 회원별로 집계합니다.
          </p>
        </>
      )}
      {compact && (
        <p className="text-xs text-gray-500 font-light leading-relaxed mb-4">
          선택한 달의 예약 중 완료·출석·체크인 처리된 수업 건수를 회원별로 집계합니다.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-[10px] text-gray-400 tracking-widest uppercase block mb-1.5">연도</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-[#064e3b]/20"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-400 tracking-widest uppercase block mb-1.5">월</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-[#064e3b]/20 min-w-[88px]"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-[#064e3b] text-white px-6 py-2 rounded-xl text-sm font-medium tracking-wide shadow-sm hover:bg-[#053d2f] disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          <FileSpreadsheet size={18} strokeWidth={ICON_STROKE} className="shrink-0 opacity-95" aria-hidden />
          {busy ? '생성 중…' : '엑셀 다운로드'}
        </button>
      </div>
    </>
  );

  if (compact) {
    return <div className="w-full">{form}</div>;
  }

  return (
    <section
      className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100/90"
      aria-label="월간 페이롤 정산"
    >
      {form}
    </section>
  );
}
