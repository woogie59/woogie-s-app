import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { LogOut, QrCode, Users, Calendar, Archive, NotebookPen, ChevronDown, Table2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchMembersBalanceSummaries } from '../../utils/sessionHelpers';
import LabDotBrand from '../../components/ui/LabDotBrand';

const ICON_STROKE = 1.5;

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

const daysSinceCheckIn = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const n = new Date();
  return Math.max(0, Math.floor((n.getTime() - d.getTime()) / 86400000));
};

const VISIBLE_UNCONFIRMED = 1;

/** MVP: 지식창고(라이브러리)·트레이닝 일지 메뉴 비표시 — 라우트/컴포넌트는 유지 */
const MVP_HIDE_LIBRARY_AND_TRAINING_NAV = true;

const AdminHome = ({ setView, logout, onOpenTrainingLog }) => {
  const [unscheduledVips, setUnscheduledVips] = useState([]);
  const [radarLoading, setRadarLoading] = useState(true);
  const [unconfirmedExpanded, setUnconfirmedExpanded] = useState(false);

  const loadUnscheduledVipRadar = useCallback(async () => {
    setRadarLoading(true);
    try {
      const { data: allMembers, error: memErr } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .neq('role', 'admin');

      if (memErr) throw memErr;

      const memberRows = allMembers || [];
      const memberIds = memberRows.map((p) => p.id).filter(Boolean);
      const summaries = await fetchMembersBalanceSummaries(supabase, memberIds);
      const members = memberRows
        .map((p) => ({
          ...p,
          computedRemaining: summaries[p.id]?.remaining ?? 0,
        }))
        .filter((p) => p.computedRemaining > 0);

      const schSelect = 'user_id, date, time, status';
      const fromBookings = await supabase.from('bookings').select(schSelect);
      if (fromBookings.error) throw fromBookings.error;
      const scheduleRows = fromBookings.data || [];

      const now = new Date();
      const userIdsWithFuture = new Set();
      (scheduleRows || []).forEach((row) => {
        if (row?.user_id && isFutureScheduleRow(row, now)) {
          userIdsWithFuture.add(row.user_id);
        }
      });

      const list = (members || []).filter((p) => p?.id && !userIdsWithFuture.has(p.id));
      const ids = list.map((p) => p.id);
      const lastByUser = {};
      if (ids.length > 0) {
        const { data: logs, error: logErr } = await supabase
          .from('attendance_logs')
          .select('user_id, check_in_at')
          .in('user_id', ids)
          .order('check_in_at', { ascending: false });
        if (!logErr && Array.isArray(logs)) {
          logs.forEach((row) => {
            if (row?.user_id && lastByUser[row.user_id] == null) {
              lastByUser[row.user_id] = row.check_in_at;
            }
          });
        }
      }
      const enriched = list.map((p) => ({
        ...p,
        lastCheckInAt: lastByUser[p.id] ?? null,
      }));
      setUnscheduledVips(enriched);
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

  const radarDebounceRef = useRef(null);
  useEffect(() => {
    const schedule = () => {
      if (radarDebounceRef.current != null) clearTimeout(radarDebounceRef.current);
      radarDebounceRef.current = window.setTimeout(() => {
        radarDebounceRef.current = null;
        void loadUnscheduledVipRadar();
      }, 450);
    };
    const ch = supabase
      .channel('admin_home_unscheduled_radar_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_batches' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, schedule)
      .subscribe();
    return () => {
      if (radarDebounceRef.current != null) clearTimeout(radarDebounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [loadUnscheduledVipRadar]);

  const menuItems = [
    { icon: Users, label: '회원 관리', view: 'member_list' },
    { icon: Table2, label: 'Payroll · Attendance', view: 'admin_payroll' },
    { icon: Calendar, label: '일정 관리', view: 'admin_schedule' },
    { icon: Archive, label: '라이브러리', view: 'library' },
    { icon: NotebookPen, label: '트레이닝 일지', action: 'training_log' },
  ].filter((item) => {
    if (!MVP_HIDE_LIBRARY_AND_TRAINING_NAV) return true;
    if (item.view === 'library') return false;
    if (item.action === 'training_log') return false;
    return true;
  });

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-slate-900 flex flex-col font-sans relative pb-safe">
      <header className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 p-6 shrink-0 bg-gray-50">
        <div aria-hidden className="min-w-0" />
        <div className="flex min-w-0 flex-col items-center text-center">
          <LabDotBrand variant="header" />
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gray-400">Manager Mode</p>
        </div>
        <div className="flex justify-end pt-0.5">
          <button type="button" onClick={logout} aria-label="Log out" className="rounded-lg p-1.5 transition-colors hover:bg-gray-100/80">
            <LogOut size={20} strokeWidth={ICON_STROKE} className="text-gray-600" />
          </button>
        </div>
      </header>

      {/* 일정 미확정 회원 — full-width data card (no in-app scheduling action) */}
      <section className="w-full max-w-lg mx-auto px-6 pb-5">
        <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-start gap-4">
          <div className="w-full">
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">수업 미예약 회원</h2>
          </div>

          {radarLoading ? (
            <p className="text-sm text-gray-400 font-light tracking-wide">Scanning…</p>
          ) : unscheduledVips.length === 0 ? (
            <p className="text-sm text-gray-500 font-light tracking-wide w-full">모든 활성 회원의 일정이 채워져 있습니다.</p>
          ) : (
            <>
              <motion.ul layout className="w-full space-y-5">
                {(unconfirmedExpanded ? unscheduledVips : unscheduledVips.slice(0, VISIBLE_UNCONFIRMED)).map((u) => {
                  const days = u.lastCheckInAt != null ? daysSinceCheckIn(u.lastCheckInAt) : null;
                  const secondary =
                    days != null
                      ? `마지막 수업 후 ${days}일 경과`
                      : `잔여 ${u.computedRemaining ?? 0}회`;
                  return (
                    <motion.li
                      key={u.id}
                      layout
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="w-full"
                    >
                      <p className="text-sm font-semibold text-slate-900 tracking-tight">{u.name || 'Member'}</p>
                      <p className="text-sm text-gray-500 mt-1 font-light tracking-wide">{secondary}</p>
                    </motion.li>
                  );
                })}
              </motion.ul>
              {unscheduledVips.length > 1 && (
                <button
                  type="button"
                  onClick={() => setUnconfirmedExpanded((e) => !e)}
                  className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium tracking-wide text-gray-500 transition-colors duration-300 ease-in-out hover:bg-gray-50 hover:text-gray-700"
                  aria-expanded={unconfirmedExpanded}
                >
                  <span>{unconfirmedExpanded ? '접기' : '더 보기'}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ease-in-out ${unconfirmedExpanded ? 'rotate-180' : ''}`}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* QR Scanner — full-width tactile card */}
      <div className="w-full max-w-lg mx-auto px-6 pb-5">
        <button
          type="button"
          onClick={() => setView('scanner')}
          className="w-full bg-[#064e3b] text-white rounded-2xl shadow-md p-5 flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.98] cursor-pointer hover:shadow-lg hover:bg-[#053d2f]"
        >
          <QrCode size={28} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
          <span className="text-[15px] font-medium tracking-wide">QR 체크인 스캐너</span>
        </button>
      </div>

      {/* 2×2 Bento menu */}
      <nav
        className="mx-auto grid w-full max-w-lg flex-1 grid-cols-2 gap-3 px-6 pb-8"
        aria-label="관리 메뉴"
      >
        {menuItems.map(({ icon: Icon, label, view, action }) => (
          <button
            key={view ?? action}
            type="button"
            onClick={() => {
              if (action === 'training_log') {
                onOpenTrainingLog?.();
              } else {
                setView(view);
              }
            }}
            className="aspect-square w-full min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-start justify-between transition-all duration-200 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] cursor-pointer text-left"
          >
            <Icon size={26} strokeWidth={ICON_STROKE} className="text-[#064e3b] shrink-0" aria-hidden />
            <span className="text-sm font-medium text-slate-900 tracking-tight leading-snug pr-1">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default AdminHome;
