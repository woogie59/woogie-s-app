import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchAdminOnesignalProfile } from '../../utils/notifications';
import {
  computeRemainingSessions,
  countScheduledSessionsForBalance,
  fetchSessionBalanceMetrics,
  logBoundaryMathCheck,
} from '../../utils/sessionHelpers';
import { useGlobalModal } from '../../context/GlobalModalContext';
import BackButton from '../../components/ui/BackButton';
import {
  isNextWeekBookingUnlockedKST,
  NEXT_WEEK_LOCKED_BANNER_HTML,
  NEXT_WEEK_LOCKED_TOAST_MESSAGE,
} from '../../utils/bookingDateKeys';

const ICON_STROKE = 1;
/** 1:1 — one booking per slot; used for full/disabled state only (no UI count) */
const MAX_PER_SLOT = 1;

const toDateKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** Monday 00:00:00 local */
const getMonday = (d) => {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const weekDayLabelsKo = ['월', '화', '수', '목', '금', '토', '일'];

function normalizeAvailableHours(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => Number(x)).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))].sort((a, b) => a - b);
}

/** Hour 0–23 from "HH:mm" time slot */
function slotHourFromTime(time) {
  const [h] = String(time).split(':').map(Number);
  return Number.isFinite(h) ? h : -1;
}

const ClassBooking = ({ user, setView, goBack }) => {
  const { showAlert, showConfirm } = useGlobalModal();
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState([]);
  const [holidays, setHolidays] = useState([]);
  /** 'current' | 'next' — next week visible only after drop */
  const [weekMode, setWeekMode] = useState('current');
  /** Non-blocking toast when next week is still locked */
  const [weekToast, setWeekToast] = useState(null);

  const now = useMemo(() => new Date(), []);
  const thisMonday = useMemo(() => getMonday(now), [now]);
  const nextMonday = useMemo(() => addDays(thisMonday, 7), [thisMonday]);

  const activeWeekStart = weekMode === 'current' ? thisMonday : nextMonday;

  const [nextWeekLockTick, setNextWeekLockTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNextWeekLockTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const nextUnlocked = useMemo(() => isNextWeekBookingUnlockedKST(new Date()), [nextWeekLockTick]);

  const weekDates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      arr.push(addDays(activeWeekStart, i));
    }
    return arr;
  }, [activeWeekStart]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('trainer_settings').select('*').order('day_of_week');
      setSettings(error ? [] : data || []);
    };
    const fetchHolidays = async () => {
      const { data, error } = await supabase.from('trainer_holidays').select('date');
      setHolidays(error ? [] : (data || []).map((h) => h.date));
    };
    fetchSettings();
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const fetchBookings = async () => {
      setLoading(true);
      try {
        // 회원 화면 슬롯 가용성: 해당 날짜의 bookings 행 수로 점유를 판단(countSlot). 행 삭제 시 슬롯이 즉시 비워짐.
        const { data, error } = await supabase.from('bookings').select('*').eq('date', selectedDate);
        if (error) throw error;
        setBookings(Array.isArray(data) ? data : []);
      } catch {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [selectedDate]);

  useEffect(() => {
    if (!weekToast) return;
    const t = setTimeout(() => setWeekToast(null), 3800);
    return () => clearTimeout(t);
  }, [weekToast]);

  const countSlot = (dateStr, time) => bookings.filter((b) => b.date === dateStr && b.time === time).length;

  const getDaySetting = (dateStr) => {
    const d = new Date(`${dateStr}T12:00:00`);
    const dayOfWeek = d.getDay();
    const row = settings.find((s) => s.day_of_week === dayOfWeek);
    return row
      ? { ...row, available_hours: normalizeAvailableHours(row.available_hours) }
      : { off: dayOfWeek === 0, available_hours: [] };
  };

  const isHoliday = (dateStr) => holidays.includes(dateStr);

  const toMins = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const isHourInAvailableMatrix = (dateStr, time) => {
    const daySet = getDaySetting(dateStr);
    const hours = daySet.available_hours || [];
    const h = slotHourFromTime(time);
    if (h < 0 || h > 23) return false;
    return hours.includes(h);
  };

  const isSlotExpired = (dateStr, time) => {
    if (dateStr !== toDateKey(new Date())) return false;
    const slotMins = toMins(time);
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    return slotMins <= nowMins;
  };

  const generateTimeSlots = useCallback(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate;
    if (isHoliday(dateStr)) return [];
    if (getDaySetting(dateStr).off) return [];

    const hours = getDaySetting(dateStr).available_hours || [];
    return hours.map((h) => `${String(h).padStart(2, '0')}:00`);
  }, [selectedDate, settings, holidays]);

  const slotRemaining = (time) => Math.max(0, MAX_PER_SLOT - countSlot(selectedDate, time));

  const isSlotBookable = (time) => {
    if (!selectedDate) return false;
    if (isHoliday(selectedDate)) return false;
    if (getDaySetting(selectedDate).off) return false;
    if (!isHourInAvailableMatrix(selectedDate, time)) return false;
    if (isSlotExpired(selectedDate, time)) return false;
    return slotRemaining(time) > 0;
  };

  const handleBookSlot = (timeSlot) => {
    if (!isSlotBookable(timeSlot)) return;
    const date = selectedDate;
    showConfirm({
      title: '수업 예약',
      message: `${date} ${timeSlot} 수업을 예약하시겠습니까?`,
      confirmLabel: '예약확인',
      onConfirm: async () => {
        const metrics = await fetchSessionBalanceMetrics(supabase, user.id);
        const { data: userBookings, error: bookingsLoadErr } = await supabase
          .from('bookings')
          .select('date, time, status')
          .eq('user_id', user.id);
        if (bookingsLoadErr) console.warn('[ClassBooking] bookings for balance:', bookingsLoadErr.message);

        const totalSessions = metrics.totalPurchased;
        const completedSessions = metrics.usedSessionCount;
        const scheduledSessions = countScheduledSessionsForBalance(userBookings || []);
        const calculatedRemaining = computeRemainingSessions(totalSessions, completedSessions);

        if (calculatedRemaining <= 0) {
          logBoundaryMathCheck({
            totalSessions,
            completedSessions,
            scheduledSessions,
            calculatedRemaining,
          });
          showAlert({ message: '사용가능한 티켓이 없습니다.', confirmLabel: '확인' });
          return;
        }

        const { error } = await supabase.from('bookings').insert([{ user_id: user.id, date, time: timeSlot }]).select();
        if (error) {
          const em = error?.message ?? '';
          if (/ticket|티켓|session|세션|remaining|잔여/i.test(em) || em.toLowerCase().includes('no remaining')) {
            logBoundaryMathCheck({
              totalSessions,
              completedSessions,
              scheduledSessions,
              calculatedRemaining: computeRemainingSessions(totalSessions, completedSessions),
            });
            showAlert({ message: '사용가능한 티켓이 없습니다.', confirmLabel: '확인' });
            return;
          }
          throw error;
        }
        showAlert({ message: '예약이 완료되었습니다!', confirmLabel: '확인' });
        const { data: updated } = await supabase.from('bookings').select('*').eq('date', date);
        setBookings(updated || []);
        try {
          const { adminProfile, error: adminProfileErr } = await fetchAdminOnesignalProfile();
          if (adminProfileErr) {
            console.warn('[ClassBooking] admin profile:', adminProfileErr.message);
          }
          console.log('🎯 Triggering Push to Admin ID:', adminProfile?.onesignal_id);
          if (!adminProfile?.onesignal_id) {
            console.warn(
              '🎯 Push skipped: admin onesignal_id missing (set profiles.onesignal_id for admin or apply get_admin_onesignal_player_id migration)'
            );
          } else {
            const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
            const memberName =
              (prof?.name && String(prof.name).trim()) ||
              user?.user_metadata?.full_name ||
              user?.user_metadata?.name ||
              user?.email ||
              '회원';
            const { data, error } = await supabase.functions.invoke('notify-admin-events', {
              body: {
                targetId: adminProfile.onesignal_id,
                title: '새로운 세션 확정',
                message: `${memberName}님 - ${date} ${timeSlot}`,
              },
            });
            console.log('📡 [Edge Function Result]:', data);
            if (error) console.error('🚨 [Edge Function Error]:', error);
          }
        } catch (e) {
          console.warn('[ClassBooking] admin push:', e);
        }
      },
    });
  };

  const todayKey = toDateKey(new Date());

  const handleSelectWeekMode = (mode) => {
    if (mode === 'next' && !nextUnlocked) {
      setWeekToast(NEXT_WEEK_LOCKED_TOAST_MESSAGE);
      return;
    }
    setWeekMode(mode);
    setSelectedDate(null);
  };

  const showNextWeekLocked = weekMode === 'next' && !nextUnlocked;

  return (
    <div className="bg-gray-50 text-slate-900 flex flex-col overflow-hidden max-w-full min-h-[100dvh] font-sans antialiased">
      <div className="shrink-0 px-5 pt-6 pb-3 border-b border-gray-100/90 bg-gray-50">
        <BackButton onClick={goBack} />
        <header className="mt-4 mb-5">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 font-medium">CLASS BOOKING</p>
          <h1 className="text-xl font-light text-slate-900 tracking-wide mt-1">수업 예약</h1>
        </header>

        {/* Week toggle — silent luxury */}
        <div className="flex gap-2 p-1 rounded-2xl bg-white/80 border border-gray-100 shadow-sm">
          <button
            type="button"
            onClick={() => handleSelectWeekMode('current')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-light tracking-wide transition-all duration-200 active:scale-[0.98] ${
              weekMode === 'current'
                ? 'bg-[#064e3b] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            이번 주
          </button>
          <button
            type="button"
            onClick={() => handleSelectWeekMode('next')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-light tracking-wide transition-all duration-200 active:scale-[0.98] ${
              weekMode === 'next'
                ? nextUnlocked
                  ? 'bg-[#064e3b] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            다음 주
          </button>
        </div>
      </div>

      {showNextWeekLocked ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-sm w-full text-center">
            <div className="flex justify-center mb-6">
              <Lock size={40} strokeWidth={ICON_STROKE} className="text-gray-300" aria-hidden />
            </div>
            <p className="text-sm font-light text-slate-800 leading-relaxed tracking-wide">
              {NEXT_WEEK_LOCKED_BANNER_HTML.lead}
              <span className="text-slate-900 font-medium">{NEXT_WEEK_LOCKED_BANNER_HTML.highlight}</span>
              {NEXT_WEEK_LOCKED_BANNER_HTML.trail}
            </p>
            <p className="text-xs font-light text-gray-400 mt-4 leading-relaxed tracking-wide">
              최상의 세션 퀄리티를 위해 주간 단위로 일정을 오픈합니다.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="shrink-0 px-5 pt-4 pb-2 overflow-hidden">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-3 font-medium">
              {weekMode === 'current' ? 'THIS_WEEK' : 'NEXT_WEEK'}
            </p>
            <div
              className="flex gap-2 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 scrollbar-hide"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
            >
              {weekDates.map((date) => {
                const dateStr = toDateKey(date);
                const dow = date.getDay();
                const labelKo = weekDayLabelsKo[dow === 0 ? 6 : dow - 1];
                const dayNum = date.getDate();
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === todayKey;
                const isPast = dateStr < todayKey;
                const isHolidayDate = isHoliday(dateStr);
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => !isPast && setSelectedDate(dateStr)}
                    disabled={isPast}
                    className={`shrink-0 min-w-[52px] py-3 px-2 rounded-2xl border flex flex-col items-center justify-center transition-all duration-200 active:scale-[0.98] ${
                      isSelected
                        ? 'bg-[#064e3b] border-[#064e3b] text-white shadow-md'
                        : isPast
                          ? 'bg-gray-100/80 border-transparent text-gray-300 cursor-not-allowed opacity-60'
                          : isHolidayDate
                            ? 'bg-red-50/80 border-red-100 text-red-700/90'
                            : 'bg-white border-gray-100 text-slate-700 hover:border-gray-200 shadow-sm'
                    }`}
                  >
                    <span className="text-[10px] font-light tracking-widest uppercase opacity-80">{labelKo}</span>
                    <span className="text-lg font-light tabular-nums mt-0.5">{dayNum}</span>
                    {isToday && (
                      <span className="text-[9px] font-light mt-0.5 opacity-90">오늘</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            id="time-slots-container"
            className="flex-1 min-h-0 overflow-y-auto overscroll-y-none px-5 pb-safe pt-2"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {selectedDate && (
              <>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4 font-medium">AVAILABLE SLOTS</p>
                {isHoliday(selectedDate) ? (
                  <p className="text-center text-sm font-light text-gray-500 py-12 tracking-wide">휴무일입니다.</p>
                ) : getDaySetting(selectedDate).off ? (
                  <p className="text-center text-sm font-light text-gray-500 py-12 tracking-wide">휴무일입니다.</p>
                ) : loading ? (
                  <p className="text-center text-sm text-gray-400 py-12 font-light">불러오는 중…</p>
                ) : generateTimeSlots().length === 0 ? (
                  <p className="text-center text-sm font-light text-gray-500 py-12">이 날짜에 열린 슬롯이 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2.5 pb-10">
                    {generateTimeSlots().map((time) => {
                      const remaining = slotRemaining(time);
                      const full = remaining <= 0;
                      const expired = isSlotExpired(selectedDate, time);
                      const clickable = isSlotBookable(time);
                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={!clickable}
                          onClick={() => handleBookSlot(time)}
                          className={`inline-flex items-center justify-center min-w-[5.25rem] rounded-full border px-5 py-2.5 text-sm font-light tracking-wide text-center transition-all duration-200 ${
                            full || expired
                              ? 'opacity-45 cursor-not-allowed border-gray-100/90 bg-gray-50/80 text-gray-400'
                              : clickable
                                ? 'border-gray-200/90 bg-white text-slate-900 shadow-sm active:scale-[0.98] hover:border-[#064e3b]/30 hover:shadow-[0_1px_0_rgba(6,78,59,0.06)]'
                                : 'opacity-45 cursor-not-allowed border-gray-100/90 bg-gray-50/80 text-gray-400'
                          }`}
                        >
                          <span className={expired ? 'line-through tabular-nums' : 'tabular-nums'}>{time}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {!selectedDate && (
              <p className="text-center text-sm font-light text-gray-400 py-16 tracking-wide">날짜를 선택해 주세요.</p>
            )}
          </div>
        </>
      )}

      {/* Sleek toast — next week locked (non-blocking) */}
      {weekToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-[300] w-[min(92vw,20rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900/92 px-5 py-3.5 text-center text-[13px] font-light leading-snug tracking-wide text-white/95 shadow-xl font-sans"
        >
          {weekToast}
        </div>
      )}
    </div>
  );
};

export default ClassBooking;
