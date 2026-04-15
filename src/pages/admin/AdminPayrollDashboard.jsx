import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import BackButton from '../../components/ui/BackButton';

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

function toCsvCell(v) {
  const s = String(v ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(toCsvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const AdminPayrollDashboard = ({ goBack }) => {
  const { firstDay, lastDay } = useMemo(() => monthRangeISO(), []);
  const monthLabel = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  }, []);

  const [members, setMembers] = useState([]);
  const [logs, setLogs] = useState([]);
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

      const { data: logRows, error: lErr } = await supabase
        .from('attendance_logs')
        .select('*')
        .gte('created_at', firstDay)
        .lte('created_at', lastDay)
        .order('created_at', { ascending: false });

      if (lErr) throw lErr;

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
      const uid = row?.user_id;
      if (!uid) return;
      map[uid] = (map[uid] || 0) + 1;
    });
    return map;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!selectedId) return [];
    return (logs || []).filter((l) => l.user_id === selectedId);
  }, [logs, selectedId]);

  const handleExportCsv = () => {
    const counts = { ...completedCountByUser };
    const rows = [['Member Name', 'Date', 'Start Time', 'End Time', 'Total Count for Month']];

    const sorted = [...(logs || [])].sort((a, b) => {
      const na = nameByUserId[a.user_id] || '';
      const nb = nameByUserId[b.user_id] || '';
      if (na !== nb) return na.localeCompare(nb, 'ko');
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    sorted.forEach((log) => {
      const name = nameByUserId[log.user_id] || '—';
      const dateStr = formatDateOnly(log.check_in_at || log.created_at);
      const start = normalizeSessionTime(log.session_time_fixed) || sessionTimeFromCheckIn(log.check_in_at);
      const end = start !== '—' ? addMinutesToHhMm(start, 60) : '—';
      const total = counts[log.user_id] ?? 0;
      rows.push([name, dateStr, start, end, String(total)]);
    });

    const safeMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    downloadCsv(`payroll-attendance-${safeMonth}.csv`, rows);
  };

  return (
    <div className="min-h-[100dvh] bg-white text-neutral-950 font-sans">
      <header className="border-b border-neutral-200 px-6 py-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BackButton onClick={goBack} />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-950">Payroll · Attendance</h1>
            <p className="mt-2 text-sm text-neutral-500 font-normal tracking-wide">
              Digital evidence — {monthLabel} · created_at range
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || !(logs || []).length}
            className="shrink-0 border border-neutral-900 bg-neutral-900 text-white px-5 py-3 text-sm font-medium tracking-wide hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Export CSV
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
                          {monthLabel} · {n} completed
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
                        <th className="py-3 px-4 font-semibold text-neutral-900 whitespace-nowrap">Created at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="border-b border-neutral-100 last:border-0">
                          <td className="py-3 px-4 text-neutral-800 tabular-nums whitespace-nowrap">
                            {formatDateOnly(log.check_in_at || log.created_at)}
                          </td>
                          <td className="py-3 px-4 text-neutral-800 tabular-nums whitespace-nowrap">
                            {normalizeSessionTime(log.session_time_fixed) || sessionTimeFromCheckIn(log.check_in_at)}
                          </td>
                          <td className="py-3 px-4 text-neutral-800 whitespace-nowrap">Completed</td>
                          <td className="py-3 px-4 text-neutral-600 tabular-nums whitespace-nowrap text-xs">
                            {formatDateTime(log.created_at)}
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
