import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { supabase } from '../../lib/supabaseClient';
import BackButton from '../../components/ui/BackButton';
import { isAttendanceLogCompletedForBalance } from '../../utils/sessionHelpers';

function monthRangeISO() {
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { firstDay, lastDay };
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
      if (typeof cell.v === 'number') cell.t = 'n';
      cell.s = baseCellStyle({ bold: r === headerRow0 });
    }
  }
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: headerRow0, c: 0 },
    e: { r: lastR, c: nCols - 1 },
  });
  const colW = [16, 12, 10, 10, 16, 16];
  ws['!cols'] = Array.from({ length: nCols }, (_, i) => ({ wch: colW[i] ?? 14 }));
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

const AdminPayrollDashboard = ({ goBack }) => {
  const { firstDay, lastDay } = useMemo(() => monthRangeISO(), []);
  const monthLabel = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  }, []);

  const [members, setMembers] = useState([]);
  const [logs, setLogs] = useState([]);
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
        .select('id, name, email')
        .neq('role', 'admin')
        .order('name', { ascending: true });

      if (pErr) throw pErr;

      const memberIds = (profileRows || []).map((p) => p.id).filter(Boolean);

      const [{ data: logRows, error: lErr }, { data: batchRows, error: bErr }] = await Promise.all([
        supabase
          .from('attendance_logs')
          .select('*')
          .gte('check_in_at', firstDay)
          .lte('check_in_at', lastDay)
          .order('check_in_at', { ascending: false }),
        memberIds.length
          ? supabase.from('session_batches').select('user_id, remaining_count').in('user_id', memberIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (lErr) throw lErr;
      if (bErr) {
        console.warn('[AdminPayrollDashboard] session_batches', bErr.message);
        setRemainingByUser({});
      } else {
        setRemainingByUser(sumRemainingCountByUser(batchRows));
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

  const filteredLogs = useMemo(() => {
    if (!selectedId) return [];
    return (logs || []).filter(
      (l) => l.user_id === selectedId && isAttendanceLogCompletedForBalance(l),
    );
  }, [logs, selectedId]);

  const handleExportExcel = () => {
    const header = [
      '회원 이름',
      '날짜',
      '시작 시간',
      '종료 시간',
      '이번 달 진행횟수',
      '남은 잔여횟수',
    ];

    const sorted = [...(logs || [])]
      .filter((log) => isAttendanceLogCompletedForBalance(log))
      .sort((a, b) => {
        const na = nameByUserId[a.user_id] || '';
        const nb = nameByUserId[b.user_id] || '';
        if (na !== nb) return na.localeCompare(nb, 'ko');
        return new Date(b.check_in_at || 0) - new Date(a.check_in_at || 0);
      });

    const dataRows = sorted.map((log) => {
      const name = nameByUserId[log.user_id] || '—';
      const dateStr = formatDateOnly(log.check_in_at);
      const start = normalizeSessionTime(log.session_time_fixed) || sessionTimeFromCheckIn(log.check_in_at);
      const end = start !== '—' ? addMinutesToHhMm(start, 60) : '—';
      const monthCompleted = completedCountByUser[log.user_id] ?? 0;
      const remaining = remainingByUser[log.user_id] ?? 0;
      return [name, dateStr, start, end, monthCompleted, remaining];
    });

    const aoa = [header, ...dataRows];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const nCols = header.length;
    const nData = dataRows.length;
    applyAttendanceExportStyles(ws, 0, nCols, 1 + nData);
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    const safeMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    XLSX.writeFile(wb, `payroll-attendance-${safeMonth}.xlsx`);
  };

  return (
    <div className="min-h-[100dvh] bg-white text-neutral-950 font-sans">
      <header className="border-b border-neutral-200 px-6 py-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BackButton onClick={goBack} />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-950">Payroll · Attendance</h1>
            <p className="mt-2 text-sm text-neutral-500 font-normal tracking-wide">
              Digital evidence — {monthLabel} · check_in_at range
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || !(logs || []).some((l) => isAttendanceLogCompletedForBalance(l))}
            className="shrink-0 border border-neutral-900 bg-neutral-900 text-white px-5 py-3 text-sm font-medium tracking-wide hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Export Excel
          </button>
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
                          {monthLabel} · {n} completed / {rem} remaining
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
                        <th className="py-3 px-4 font-semibold text-neutral-900 whitespace-nowrap">Date</th>
                        <th className="py-3 px-4 font-semibold text-neutral-900 whitespace-nowrap">Session time</th>
                        <th className="py-3 px-4 font-semibold text-neutral-900 whitespace-nowrap">Status</th>
                        <th className="py-3 px-4 font-semibold text-neutral-900 whitespace-nowrap">Check-in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="border-b border-neutral-100 last:border-0">
                          <td className="py-3 px-4 text-neutral-800 tabular-nums whitespace-nowrap">
                            {formatDateOnly(log.check_in_at)}
                          </td>
                          <td className="py-3 px-4 text-neutral-800 tabular-nums whitespace-nowrap">
                            {normalizeSessionTime(log.session_time_fixed) || sessionTimeFromCheckIn(log.check_in_at)}
                          </td>
                          <td className="py-3 px-4 text-neutral-800 whitespace-nowrap">Completed</td>
                          <td className="py-3 px-4 text-neutral-600 tabular-nums whitespace-nowrap text-xs">
                            {formatDateTime(log.check_in_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
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
