import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import BackButton from '../../components/ui/BackButton';

const ICON_STROKE = 1;
/** Boutique: single seat per slot — show "잔여 1" when free */
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

/** Saturday 12:00 of the same calendar week as `weekMonday` (Mon–Sun week) */
const getDropSaturdayNoon = (weekMonday) => {
  const sat = addDays(weekMonday, 5);
  sat.setHours(12, 0, 0, 0);
  return sat;
};

/** Next week (Mon–Sun) unlocks after this week's Saturday noon */
const isNextWeekUnlocked = (now = new Date()) => {
  const mon = getMonday(now);
  const dropAt = getDropSaturdayNoon(mon);
  return now >= dropAt;
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

const ClassBooking = ({ user, setView }) => {
  const { showAlert, showConfirm } = useGlobalModal();
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState([]);
  const [holidays, setHolidays] = useState([]);
  /** 'current' | 'next' — next week visible only after drop */
  const [weekMode, setWeekMode] = useState('current');

  const now = useMemo(() => new Date(), []);
  const thisMonday = useMemo(() => getMonday(now), [now]);
  const nextMonday = useMemo(() => addDays(thisMonday, 7), [thisMonday]);

  const activeWeekStart = weekMode === 'current' ? thisMonday : nextMonday;

  const nextUnlocked = isNextWeekUnlocked();

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
        const { error } = await supabase.from('bookings').insert([{ user_id: user.id, date, time: timeSlot }]).select();
        if (error) throw error;
        showAlert({ message: '예약이 완료되었습니다!', confirmLabel: '확인' });
        const { data: updated } = await supabase.from('bookings').select('*').eq('date', date);
        setBookings(updated || []);
        try {
          const { data: adminProfile } = await supabase
            .from('profiles')
            .select('onesignal_id')
            .or('role.eq.admin,email.eq.admin@gmail.com')
            .limit(1)
            .maybeSingle();
          const adminOsId = adminProfile?.onesignal_id;
          if (adminOsId) {
            const memberName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '회원';
            const msg = `${memberName}님이 ${date} ${timeSlot} 수업을 예약했습니다.`;
            await fetch('https://onesignal.com/api/v1/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Basic os_v2_app_7vsxhzq33bb27gbyhnmc62binkjbrtc22o3eo3eeeqp3zluqgtusywkaagav3yyj67czyg6ioo2wfwxgvfk75l3o3m7uzagi6cbbhqq',
              },
              body: JSON.stringify({
                app_id: 'fd6573e6-1bd8-43af-9838-3b582f68286a',
                include_player_ids: [adminOsId],
                headings: { en: 'New Booking!' },
                contents: { en: msg },
              }),
            });
          }
        } catch {
          /* ignore */
        }
      },
    });
  };

  const todayKey = toDateKey(new Date());

  const handleSelectWeekMode = (mode) => {
    if (mode === 'next' && !nextUnlocked) return;
    setWeekMode(mode);
    setSelectedDate(null);
  };

  const showNextWeekLocked = weekMode === 'next' && !nextUnlocked;

  return (
    <div className="bg-gray-50 text-slate-900 flex flex-col overflow-hidden max-w-full min-h-[100dvh] font-sans antialiased">
      <div className="shrink-0 px-5 pt-6 pb-3 border-b border-gray-100/90 bg-gray-50">
        <BackButton onClick={() => setView('client_home')} label="Home" />
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
              다음 주 예약은 토요일 정오(12:00)에 오픈됩니다.
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
                          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-light tracking-wide transition-all duration-200 ${
                            full || expired
                              ? 'opacity-45 cursor-not-allowed border-gray-100/90 bg-gray-50/80 text-gray-400'
                              : clickable
                                ? 'border-gray-200/90 bg-white text-slate-900 shadow-sm active:scale-[0.98] hover:border-[#064e3b]/30 hover:shadow-[0_1px_0_rgba(6,78,59,0.06)]'
                                : 'opacity-45 cursor-not-allowed border-gray-100/90 bg-gray-50/80 text-gray-400'
                          }`}
                        >
                          <span className={expired ? 'line-through tabular-nums' : 'tabular-nums'}>{time}</span>
                          {!full && !expired && remaining > 0 && (
                            <span className="text-[10px] text-gray-400 tabular-nums font-light">잔여 {remaining}</span>
                          )}
                          {full && !expired && (
                            <span className="text-[10px] text-gray-400 font-light">만석</span>
                          )}
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
    </div>
  );
};

export default ClassBooking;
