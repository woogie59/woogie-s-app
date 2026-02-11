import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import BackButton from '../../components/ui/BackButton';

const ALL_HOURLY_SLOTS = Array.from({ length: 18 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);

const ClassBooking = ({ user, setView }) => {
  const { showAlert, showConfirm } = useGlobalModal();
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  const toDateKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  const getWeekDates = () => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(weekStart);
      dd.setDate(weekStart.getDate() + i);
      arr.push(dd);
    }
    return arr;
  };

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
      } catch (err) {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [selectedDate]);

  const isSlotBooked = (time) => bookings.some((b) => b.time === time);

  const getDaySetting = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = d.getDay();
    const row = settings.find((s) => s.day_of_week === dayOfWeek);
    return row || { off: dayOfWeek === 0, start_time: '09:00', end_time: '22:00', break_times: [] };
  };

  const isHoliday = (dateStr) => holidays.includes(dateStr);

  const toMins = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const isSlotInBreakTimes = (dateStr, time) => {
    const daySet = getDaySetting(dateStr);
    const breakTimes = daySet.break_times || [];
    const slotMins = toMins(time);
    for (const bt of breakTimes) {
      const startMins = toMins(bt.start);
      const endMins = toMins(bt.end);
      if (slotMins >= startMins && slotMins < endMins) return true;
    }
    return false;
  };

  const isSlotInWorkingHours = (dateStr, time) => {
    const daySet = getDaySetting(dateStr);
    const startMins = toMins(daySet.start_time || '09:00');
    const endMins = toMins(daySet.end_time || '22:00');
    const slotMins = toMins(time);
    return slotMins >= startMins && slotMins < endMins;
  };

  const isSlotExpired = (dateStr, time) => {
    if (dateStr !== toDateKey(new Date())) return false;
    const now = new Date();
    const slotMins = toMins(time);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return slotMins <= nowMins;
  };

  const generateTimeSlots = () => {
    if (!selectedDate) return [];
    const dateStr = selectedDate;
    const daySet = getDaySetting(dateStr);

    if (isHoliday(dateStr)) return [];
    if (daySet.off) return [];

    return ALL_HOURLY_SLOTS.filter((time) => {
      if (!isSlotInWorkingHours(dateStr, time)) return false;
      if (isSlotInBreakTimes(dateStr, time)) return false;
      return true;
    });
  };

  const isSlotAvailable = (time) => {
    if (!selectedDate) return false;
    if (isSlotBooked(time)) return false;
    if (isHoliday(selectedDate)) return false;
    if (getDaySetting(selectedDate).off) return false;
    if (!isSlotInWorkingHours(selectedDate, time)) return false;
    if (isSlotInBreakTimes(selectedDate, time)) return false;
    if (isSlotExpired(selectedDate, time)) return false;
    return true;
  };

  const handleBookSlot = (timeSlot) => {
    if (!isSlotAvailable(timeSlot)) return;
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
                headings: { en: 'New Booking! 📅' },
                contents: { en: msg },
              }),
            });
          }
        } catch (_) {}
      },
    });
  };

  return (
    <div className="bg-zinc-950 text-white flex flex-col overflow-hidden max-w-full h-[100dvh]" style={{ height: '100dvh' }}>
      <div className="shrink-0 p-6 pb-4">
        <div className="touch-none">
          <BackButton onClick={() => setView('client_home')} label="Home" />
          <header className="text-center mb-6">
            <h2 className="text-lg font-serif text-yellow-500">CLASS BOOKING</h2>
          </header>
        </div>
        <div className="max-w-full" style={{ touchAction: 'pan-x' }}>
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => {
                const p = new Date(weekStart);
                p.setDate(p.getDate() - 7);
                setWeekStart(p);
              }}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"
            >
              <ChevronLeft size={22} />
            </button>
            <span className="text-sm text-zinc-400">
              {getWeekDates()[0].toLocaleDateString('en-US', { weekday: 'short' })} {getWeekDates()[0].getDate()} -{' '}
              {getWeekDates()[6].toLocaleDateString('en-US', { weekday: 'short' })} {getWeekDates()[6].getDate()}
            </span>
            <button
              onClick={() => {
                const n = new Date(weekStart);
                n.setDate(n.getDate() + 7);
                setWeekStart(n);
              }}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"
            >
              <ChevronRight size={22} />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-none pb-2 max-w-full">
            {getWeekDates().map((date) => {
              const dateStr = toDateKey(date);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              const dayNum = date.getDate();
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === toDateKey(new Date());
              const todayKey = toDateKey(new Date());
              const isPast = dateStr < todayKey;
              const isHolidayDate = isHoliday(dateStr);
              return (
                <button
                  key={dateStr}
                  onClick={() => !isPast && setSelectedDate(dateStr)}
                  disabled={isPast}
                  className={`shrink-0 p-3 rounded-xl border flex flex-col items-center min-w-[64px] ${
                    isSelected
                      ? 'bg-yellow-600 border-yellow-500 text-white'
                      : isPast
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed'
                        : isHolidayDate
                          ? 'bg-red-900/20 border-red-800/50 text-zinc-500'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-yellow-600/50'
                  }`}
                >
                  <span className="text-[10px] uppercase">{dayName}</span>
                  <span className="text-lg font-bold">{dayNum}</span>
                  {isToday && <span className="text-[9px] text-yellow-500 mt-0.5">Today</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        id="time-slots-container"
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-none px-6 pb-20"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {selectedDate && (
          <>
            <h3 className="text-sm text-zinc-400 mb-3 uppercase tracking-widest">예약 가능 시간</h3>
            {isHoliday(selectedDate) ? (
              <p className="text-center text-zinc-400 py-8">Today is a trainer&apos;s day off. 💤</p>
            ) : getDaySetting(selectedDate).off ? (
              <p className="text-center text-zinc-400 py-8">Today is a trainer&apos;s day off. 💤</p>
            ) : loading ? (
              <p className="text-center text-zinc-600 py-10">Loading...</p>
            ) : generateTimeSlots().length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No available slots for this day.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-w-full w-full pb-2">
                {generateTimeSlots().map((time) => {
                  const available = isSlotAvailable(time);
                  const booked = isSlotBooked(time);
                  const expired = isSlotExpired(selectedDate, time);
                  const disabled = !available;
                  return (
                    <button
                      key={time}
                      disabled={disabled}
                      onClick={() => handleBookSlot(time)}
                      className={`p-4 rounded-xl border text-lg font-bold flex justify-between items-center transition ${
                        expired
                          ? 'bg-zinc-900/30 border-zinc-800 text-zinc-600 cursor-not-allowed'
                          : booked
                            ? 'bg-zinc-900/50 border-zinc-800 text-zinc-700 cursor-not-allowed'
                            : available
                              ? 'bg-zinc-900 border-zinc-800 text-white hover:border-yellow-600'
                              : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed'
                      }`}
                    >
                      <span className={expired ? 'line-through' : ''}>{time}</span>
                      {booked && <span className="text-xs text-red-500">예약됨</span>}
                      {expired && !booked && <span className="text-xs text-zinc-500">지남</span>}
                      {available && <span className="text-green-500">●</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ClassBooking;
