import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Users, Calendar, Archive, NotebookPen, ChevronDown, Table2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchMembersBalanceSummaries, fetchSessionBalanceMetrics } from '../../utils/sessionHelpers';
import LabDotBrand from '../../components/ui/LabDotBrand';
import toast from 'react-hot-toast';

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
  const [lowCreditAlert, setLowCreditAlert] = useState(null);
  const [overview, setOverview] = useState({ total: 0, active: 0, unbooked: 0 });
  const realtimeToastTimerRef = useRef(null);

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
      setOverview({
        total: memberRows.length,
        active: members.length,
        unbooked: enriched.length,
      });
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

  const loadLatestLowCreditAlert = useCallback(async () => {
    const { data, error } = await supabase
      .from('admin_low_credit_alerts')
      .select('id, user_id, user_name, remaining_sessions, created_at, dismissed_at')
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[AdminHome] low-credit alert load:', error);
      setLowCreditAlert(null);
      return;
    }
    setLowCreditAlert(data || null);
  }, []);

  useEffect(() => {
    loadLatestLowCreditAlert();
  }, [loadLatestLowCreditAlert]);

  useEffect(() => {
    const ch = supabase
      .channel('admin_low_credit_alerts_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_low_credit_alerts' }, () => {
        void loadLatestLowCreditAlert();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadLatestLowCreditAlert]);

  const dismissLowCreditAlert = useCallback(async () => {
    if (!lowCreditAlert?.id) return;
    const { error } = await supabase
      .from('admin_low_credit_alerts')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', lowCreditAlert.id);
    if (error) {
      console.warn('[AdminHome] low-credit alert dismiss:', error);
      return;
    }
    setLowCreditAlert(null);
  }, [lowCreditAlert]);

  useEffect(() => {
    const ch = supabase
      .channel('admin_attendance_low_credit_toast_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_logs' }, async (payload) => {
        const uid = payload?.new?.user_id;
        if (!uid) return;
        try {
          const [{ data: profile }, metrics] = await Promise.all([
            supabase.from('profiles').select('name').eq('id', uid).maybeSingle(),
            fetchSessionBalanceMetrics(supabase, uid),
          ]);
          const remaining = metrics?.remaining ?? null;
          if (remaining == null) return;
          if (realtimeToastTimerRef.current != null) clearTimeout(realtimeToastTimerRef.current);
          toast(
            `✅ 출석 알림: ${profile?.name || '회원'}님이 출석했습니다. (잔여: ${remaining}회)`,
            { icon: '🔔' }
          );
          if (remaining <= 5) {
            toast.error(`🚨 ${profile?.name || '회원'}님 수강권 만료 임박! (잔여 ${remaining}회)`);
          }
          if (typeof window !== 'undefined' && window.AudioContext) {
            const ctx = new window.AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = 880;
            gain.gain.value = 0.02;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.09);
            osc.onended = () => ctx.close();
          }
          realtimeToastTimerRef.current = window.setTimeout(() => {
            realtimeToastTimerRef.current = null;
          }, 3500);
        } catch (e) {
          console.warn('[AdminHome] realtime low-credit toast:', e);
        }
      })
      .subscribe();
    return () => {
      if (realtimeToastTimerRef.current != null) clearTimeout(realtimeToastTimerRef.current);
      supabase.removeChannel(ch);
    };
  }, []);

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

  const goMenu = useCallback(
    ({ view, action }) => {
      if (action === 'training_log') {
        onOpenTrainingLog?.();
      } else if (view) {
        setView(view);
      }
    },
    [onOpenTrainingLog, setView]
  );

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

      <section className="w-full max-w-lg mx-auto px-6 pb-4">
        <div className="text-sm text-gray-500 font-medium tracking-wide flex justify-center gap-3 my-4">
          <span>전체 회원 <span className="font-semibold text-slate-900">{overview.total}</span></span>
          <span>|</span>
          <span>활성 회원 <span className="font-semibold text-slate-900">{overview.active}</span></span>
        </div>
      </section>

      {lowCreditAlert && (
        <section className="w-full max-w-lg mx-auto px-6 pb-3">
          <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-red-700 uppercase">High Priority</p>
                <p className="mt-1 text-sm font-semibold text-red-900">
                  {lowCreditAlert.user_name}님 잔여 {lowCreditAlert.remaining_sessions}회
                </p>
                <p className="mt-0.5 text-xs text-red-700">세션 만료 임박 회원입니다. 재등록 안내를 권장합니다.</p>
              </div>
              <button
                type="button"
                onClick={dismissLowCreditAlert}
                className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 일정 미확정 회원 — full-width data card (no in-app scheduling action) */}
      <section className="w-full max-w-lg mx-auto px-6 pb-5">
        <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-start gap-4">
          <div className="w-full">
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              수업 미예약 회원 <span className="text-[#064e3b] font-bold">({overview.unbooked}명)</span>
            </h2>
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

      {/* Primary + Secondary actions */}
      <section className="mx-auto w-full max-w-lg px-6 pb-10 pt-1">
        <nav className="grid grid-cols-2 gap-4" aria-label="주요 관리 메뉴">
          <button
            type="button"
            onClick={() => goMenu({ view: 'member_list' })}
            className="aspect-square w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-start justify-between transition-all duration-200 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] cursor-pointer text-left"
          >
            <Users size={26} strokeWidth={ICON_STROKE} className="text-[#064e3b] shrink-0" aria-hidden />
            <span className="text-sm font-medium text-slate-900 tracking-tight leading-snug pr-1">회원 관리</span>
          </button>

          <button
            type="button"
            onClick={() => goMenu({ view: 'admin_schedule' })}
            className="aspect-square w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-start justify-between transition-all duration-200 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] cursor-pointer text-left"
          >
            <Calendar size={26} strokeWidth={ICON_STROKE} className="text-[#064e3b] shrink-0" aria-hidden />
            <span className="text-sm font-medium text-slate-900 tracking-tight leading-snug pr-1">일정 관리</span>
          </button>
        </nav>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => goMenu({ view: 'admin_payroll' })}
            className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between transition-all duration-200 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.99] cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <Table2 size={24} strokeWidth={ICON_STROKE} className="text-[#064e3b] shrink-0" aria-hidden />
              <span className="text-sm font-medium text-slate-900 tracking-tight">페이롤 · 출석</span>
            </div>
            <span className="text-xs text-gray-400">보조 메뉴</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default AdminHome;
