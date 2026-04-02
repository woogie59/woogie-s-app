import React, { useEffect, useState, useCallback } from 'react';
import { LogOut, QrCode } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import LabDotBrand from '../../components/ui/LabDotBrand';
import ButtonGhost from '../../components/ui/ButtonGhost';

/** LAB DOT green */
const LAB_DOT = '#064e3b';

const toDateKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const m = timeStr.trim().match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

/** Booking is in the future (local) — excludes cancelled when status exists */
const isFutureScheduleRow = (row, now = new Date()) => {
  if (row?.status === 'cancelled') return false;
  const dateStr = String(row.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const todayKey = toDateKey(now);
  if (dateStr > todayKey) return true;
  if (dateStr < todayKey) return false;
  return parseTimeToMinutes(row.time) >= now.getHours() * 60 + now.getMinutes();
};

const AdminHome = ({ setView, logout, setSelectedMemberId }) => {
  const [unscheduledVips, setUnscheduledVips] = useState([]);
  const [radarLoading, setRadarLoading] = useState(true);

  const loadUnscheduledVipRadar = useCallback(async () => {
    setRadarLoading(true);
    try {
      const { data: members, error: memErr } = await supabase
        .from('profiles')
        .select('id, name, remaining_sessions, email, role')
        .gt('remaining_sessions', 0)
        .neq('role', 'admin');

      if (memErr) throw memErr;

      let scheduleRows = [];
      const schSelect = 'user_id, date, time, status';
      const fromSchedules = await supabase.from('schedules').select(schSelect);
      if (!fromSchedules.error && Array.isArray(fromSchedules.data)) {
        scheduleRows = fromSchedules.data;
      } else {
        const fromBookings = await supabase.from('bookings').select(schSelect);
        if (fromBookings.error) throw fromBookings.error;
        scheduleRows = fromBookings.data || [];
      }

      const now = new Date();
      const userIdsWithFuture = new Set();
      (scheduleRows || []).forEach((row) => {
        if (row?.user_id && isFutureScheduleRow(row, now)) {
          userIdsWithFuture.add(row.user_id);
        }
      });

      const list = (members || []).filter((p) => p?.id && !userIdsWithFuture.has(p.id));
      setUnscheduledVips(list);
    } catch (e) {
      console.error('[Unscheduled VIP Radar]', e);
      setUnscheduledVips([]);
    } finally {
      setRadarLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnscheduledVipRadar();
  }, [loadUnscheduledVipRadar]);

  const handleScheduleNow = (userId) => {
    if (typeof setSelectedMemberId === 'function') {
      setSelectedMemberId(userId);
    }
    setView('member_detail');
  };

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 flex flex-col relative pb-safe">
      <header className="p-6 flex justify-between items-center shrink-0">
        <div>
          <LabDotBrand variant="header" />
          <p className="text-gray-400 text-[10px] tracking-[0.2em] uppercase mt-1">Manager Mode</p>
        </div>
        <button type="button" onClick={logout} aria-label="Log out">
          <LogOut size={20} className="text-gray-600 hover:text-slate-900 transition-colors" />
        </button>
      </header>

      <section className="w-full max-w-md mx-auto px-6 pb-6 border-b border-gray-100/80">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[#064e3b] shrink-0" aria-hidden />
          <h3 className="text-[11px] tracking-[0.25em] font-semibold uppercase" style={{ color: LAB_DOT }}>
            UNSCHEDULED VIPs
          </h3>
        </div>

        {radarLoading ? (
          <p className="text-gray-400 text-xs tracking-wide">Scanning…</p>
        ) : unscheduledVips.length === 0 ? (
          <p className="text-gray-400 text-sm font-light tracking-wide">All active members are fully scheduled.</p>
        ) : (
          <ul className="space-y-0 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-white">
            {unscheduledVips.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{u.name || 'Member'}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 tracking-wide uppercase">
                    Remaining <span className="text-emerald-700 font-serif tabular-nums">{u.remaining_sessions}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleScheduleNow(u.id)}
                  className="shrink-0 text-[10px] tracking-[0.15em] uppercase font-medium px-3 py-2 rounded-lg border border-[#064e3b]/25 text-[#064e3b] hover:bg-[#064e3b]/5 active:scale-[0.98] transition-colors"
                >
                  Schedule Now
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 w-full">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-green-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000" />
          <button
            type="button"
            onClick={() => setView('scanner')}
            className="relative w-48 h-48 rounded-full bg-white border border-gray-200 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
          >
            <QrCode size={40} className="text-emerald-600" />
            <span className="text-sm tracking-widest font-medium text-gray-600">CHECK-IN</span>
          </button>
        </div>

        <nav className="w-full max-w-xs space-y-2 mt-8" aria-label="Admin navigation">
          <ButtonGhost onClick={() => setView('member_list')}>MEMBERS</ButtonGhost>
          <ButtonGhost onClick={() => setView('admin_schedule')}>SCHEDULE</ButtonGhost>
          <ButtonGhost onClick={() => setView('library')}>LIBRARY</ButtonGhost>
          <ButtonGhost onClick={() => setView('admin_settings')}>SETTINGS</ButtonGhost>
          <ButtonGhost onClick={() => setView('revenue')}>REVENUE</ButtonGhost>
        </nav>
      </div>
    </div>
  );
};

export default AdminHome;
