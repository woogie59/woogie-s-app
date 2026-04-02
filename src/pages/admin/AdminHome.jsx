import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import LabDotBrand from '../../components/ui/LabDotBrand';

const ICON_STROKE = 1.5;

const toDateKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const sumSessionBatchRowRevenue = (row) => {
  if (row == null) return 0;
  const rawPrice = row.price;
  if (rawPrice != null && rawPrice !== '') {
    const p = Number(rawPrice);
    if (Number.isFinite(p) && p > 0) return p;
  }
  const tc = Number(row.total_count) || 0;
  const pps = Number(row.price_per_session) || 0;
  return tc * pps;
};

const normalizeTime = (t) => {
  if (!t || typeof t !== 'string') return '';
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : t;
};

/**
 * Single-pane intelligence feed — no navigation grid; read-first operations surface.
 */
const AdminHome = ({ setView, logout, setSelectedMemberId }) => {
  const [monthGrossKrw, setMonthGrossKrw] = useState(0);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [todayRows, setTodayRows] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [careMembers, setCareMembers] = useState([]);
  const [careLoading, setCareLoading] = useState(true);

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const loadMonthGross = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const now = new Date();
      const y = now.getFullYear();
      const mo = now.getMonth();
      const startDate = new Date(y, mo, 1, 0, 0, 0, 0);
      const endDate = new Date(y, mo + 1, 0, 23, 59, 59, 999);
      const { data, error } = await supabase
        .from('session_batches')
        .select('total_count, price_per_session, price, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;
      const sum = (data || []).reduce((acc, row) => acc + sumSessionBatchRowRevenue(row), 0);
      setMonthGrossKrw(sum);
    } catch (e) {
      console.warn('[AdminHome] gross revenue:', e);
      setMonthGrossKrw(0);
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  const loadTodayTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const schedulesRes = await supabase
        .from('schedules')
        .select('id, user_id, date, time, status, profiles(name, remaining_sessions)')
        .eq('date', todayKey)
        .order('time', { ascending: true });

      let rows = [];
      if (!schedulesRes.error && Array.isArray(schedulesRes.data) && schedulesRes.data.length > 0) {
        rows = schedulesRes.data.filter((r) => r?.status !== 'cancelled');
      } else {
        const bookRes = await supabase
          .from('bookings')
          .select('id, user_id, date, time, status, profiles(name, remaining_sessions)')
          .eq('date', todayKey)
          .order('time', { ascending: true });
        if (bookRes.error) throw bookRes.error;
        rows = (bookRes.data || []).filter((r) => r?.status !== 'cancelled');
      }

      const sorted = [...rows].sort((a, b) => normalizeTime(a.time).localeCompare(normalizeTime(b.time)));
      setTodayRows(sorted);
    } catch (e) {
      console.warn('[AdminHome] today timeline:', e);
      setTodayRows([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [todayKey]);

  const loadCareMembers = useCallback(async () => {
    setCareLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, remaining_sessions, email')
        .eq('role', 'user')
        .lte('remaining_sessions', 2)
        .order('remaining_sessions', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setCareMembers(data || []);
    } catch (e) {
      console.warn('[AdminHome] care members:', e);
      setCareMembers([]);
    } finally {
      setCareLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonthGross();
    loadTodayTimeline();
    loadCareMembers();
  }, [loadMonthGross, loadTodayTimeline, loadCareMembers]);

  const fmtKrw = (n) => (Number.isFinite(n) ? `₩ ${Math.round(n).toLocaleString('ko-KR')}` : '₩ 0');

  const openMember = (userId) => {
    if (typeof setSelectedMemberId === 'function') setSelectedMemberId(userId);
    if (typeof setView === 'function') setView('member_detail');
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-slate-900 flex flex-col relative pb-safe font-sans antialiased">
      <header className="px-5 pt-6 pb-4 flex justify-between items-start gap-4 shrink-0 border-b border-gray-100/80 bg-gray-50">
        <div className="min-w-0">
          <LabDotBrand variant="header" />
          <p className="text-[10px] tracking-[0.25em] uppercase text-gray-400 mt-2 font-normal">Clinical Lab · Operations</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="p-2 rounded-xl text-gray-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-gray-100 transition-all duration-200 shrink-0"
          aria-label="로그아웃"
        >
          <LogOut size={20} strokeWidth={ICON_STROKE} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto scrollable px-5 py-5 space-y-4 min-h-0">
        {/* 1. Pulse / Gross revenue */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 font-medium">GROSS_REVENUE</p>
          <h2 className="text-base font-light text-slate-900 tracking-wide mt-2">이번 달 누적 매출</h2>
          <div className="mt-5 pt-1">
            {revenueLoading ? (
              <div className="h-12 w-48 bg-gray-100 rounded-lg animate-pulse" aria-hidden />
            ) : (
              <p className="text-3xl sm:text-4xl font-extralight tabular-nums tracking-tight text-[#064e3b]">{fmtKrw(monthGrossKrw)}</p>
            )}
            <p className="text-[11px] text-gray-400 mt-3 font-light tracking-wide">세션 팩 등록 기준 · 이번 달 합계</p>
          </div>
        </section>

        {/* 2. Today timeline */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 font-medium">TODAY_TIMELINE</p>
          <h2 className="text-base font-light text-slate-900 tracking-wide mt-1">오늘 일정</h2>

          <div className="mt-4 -mx-1">
            {timelineLoading ? (
              <p className="text-xs text-gray-400 font-light py-6 text-center tracking-wide">불러오는 중…</p>
            ) : todayRows.length === 0 ? (
              <p className="text-sm text-gray-400 font-light py-8 text-center tracking-wide leading-relaxed">오늘 예약된 수업이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-50 border-t border-gray-50">
                {todayRows.map((row) => {
                  const name = row.profiles?.name || '회원';
                  const rem = row.profiles?.remaining_sessions;
                  const remLabel = rem != null ? `잔여 ${rem}회` : '—';
                  return (
                    <li key={row.id} className="border-b border-gray-50 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => row.user_id && openMember(row.user_id)}
                        className="w-full flex items-center gap-3 py-3.5 px-2 text-left rounded-xl transition-all duration-200 active:scale-[0.98] active:bg-gray-50 hover:bg-gray-50/80"
                      >
                        <span className="text-sm font-light tabular-nums text-[#064e3b] w-[3.25rem] shrink-0">{normalizeTime(row.time)}</span>
                        <span className="flex-1 min-w-0 text-sm font-light text-slate-900 truncate tracking-wide">{name}</span>
                        <span className="text-[11px] font-light text-gray-400 tabular-nums shrink-0">{remLabel}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* 3. Care alerts */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-2">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 font-medium">CARE_REQUIRED</p>
          <h2 className="text-base font-light text-slate-900 tracking-wide mt-2">케어 필요 회원</h2>
          <p className="text-xs text-gray-400 font-light mt-2 leading-relaxed tracking-wide">잔여 2회 이하인 회원을 조용히 표시합니다.</p>

          <div className="mt-4 -mx-1">
            {careLoading ? (
              <p className="text-xs text-gray-400 font-light py-6 text-center">불러오는 중…</p>
            ) : careMembers.length === 0 ? (
              <p className="text-sm text-gray-400 font-light py-6 text-center tracking-wide">현재 해당 조건의 회원이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-50 border-t border-gray-50">
                {careMembers.map((m) => (
                  <li key={m.id} className="border-b border-gray-50 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openMember(m.id)}
                      className="w-full flex items-center justify-between gap-3 py-3.5 px-2 text-left rounded-xl transition-all duration-200 active:scale-[0.98] active:bg-gray-50 hover:bg-gray-50/80"
                    >
                      <span className="text-sm font-light text-slate-900 truncate tracking-wide">{m.name || '회원'}</span>
                      <span className="text-[11px] font-light text-gray-500 tabular-nums shrink-0">잔여 {m.remaining_sessions ?? 0}회</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminHome;
