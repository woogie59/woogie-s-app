import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Check, ChevronLeft, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { LabDotBrand } from '../../components/ui/LabDotBrand';
import {
  resolveDateAvailability,
  isResolvedDateOpen,
  ymdFromDate,
} from '../../utils/labdotWeekSchedulePolicy';
import {
  isMemberAppBookingAllowed,
  isMemberAppCancellationAllowed,
  MEMBER_CANCEL_COACH_CONTACT_MESSAGE,
} from '../../utils/bookingDateKeys';
import { isSlotBlocked, normalizeBlockTime } from '../../utils/trainerBlockedSlots';
import {
  fetchAdminOnesignalPlayerId,
  invokeNotifyAdminEvents,
} from '../../utils/notifications';
import { invokeOtBlockGoogleSync } from '../../utils/googleCalendarOtSync';

const DEEP_GREEN = '#064e3b';
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const LOOKAHEAD_DAYS = 14;

/** 검토용 데모 (?demo=1): 서버 없이 화면만 재생. 어떤 쓰기도 일어나지 않는다. */
const DEMO_PARAMS = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const IS_DEMO = DEMO_PARAMS?.get('demo') === '1';
/** 데모 전용: 특정 단계로 바로 열기 (?demo=1&phase=date|time|name|done|invalid) */
const DEMO_PHASE = IS_DEMO ? DEMO_PARAMS?.get('phase') || '' : '';

const DEMO = {
  link: { ok: true, max_sessions: 2, remaining: 2, bookings: [] },
  settings: [
    { day_of_week: 1, available_hours: [14, 15, 16, 17, 18, 19, 20, 21], off: false },
    { day_of_week: 2, available_hours: [14, 15, 16, 17, 18, 19, 20, 21], off: false },
    { day_of_week: 3, available_hours: [14, 15, 16, 17, 18, 19, 20, 21], off: false },
    { day_of_week: 4, available_hours: [14, 15, 16, 17, 18, 19, 20, 21], off: false },
    { day_of_week: 5, available_hours: [14, 15, 16, 17, 18, 19, 20, 21], off: false },
    { day_of_week: 6, available_hours: [10, 11, 12, 13, 14, 15, 16, 17], off: false },
    { day_of_week: 0, available_hours: [], off: true },
  ],
  holidays: [],
  openDates: [],
  blocked: [],
  taken: [],
  otTaken: [],
};

function formatDateLabel(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map((v) => parseInt(v, 10));
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${DAY_LABELS[dt.getDay()]})`;
}

const DEMO_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return ymdFromDate(d);
})();

const DEMO_DATE_LATER = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return ymdFromDate(d);
})();

/** 데모 전용: 내 신청 내역이 있는 상태 (?demo=1&phase=bookings) */
const DEMO_LINK_WITH_BOOKING = {
  ok: true,
  max_sessions: 2,
  remaining: 1,
  bookings: [{ id: 'demo-1', date: DEMO_DATE_LATER, time: '14:00', name: '김오티', status: 'confirmed' }],
};

export default function OtBookingPage({ token }) {
  const [phase, setPhase] = useState(() => (['date', 'time', 'name', 'done', 'invalid'].includes(DEMO_PHASE) ? DEMO_PHASE : 'loading')); // loading | invalid | main | date | time | name | done
  const [invalidReason, setInvalidReason] = useState('');
  const [link, setLink] = useState(null); // { remaining, max_sessions, bookings }
  const [avail, setAvail] = useState(null); // { settings, holidays, openDates, blocked, taken, otTaken }
  const [selectedDate, setSelectedDate] = useState(() => (DEMO_PHASE === 'time' || DEMO_PHASE === 'name' ? DEMO_DATE : null));
  const [selectedTime, setSelectedTime] = useState(() => (DEMO_PHASE === 'name' ? '15:00' : null));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [justBooked, setJustBooked] = useState(null);

  const range = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + LOOKAHEAD_DAYS - 1);
    return { from: ymdFromDate(from), to: ymdFromDate(to) };
  }, []);

  const loadLink = useCallback(async () => {
    if (IS_DEMO) {
      setLink((prev) => prev || (DEMO_PHASE === 'bookings' ? { ...DEMO_LINK_WITH_BOOKING } : { ...DEMO.link }));
      return;
    }
    const { data, error } = await supabase.rpc('ot_get_link', { p_token: token });
    if (error || !data?.ok) {
      setInvalidReason(data?.reason || 'not_found');
      setPhase('invalid');
      return;
    }
    setLink(data);
  }, [token]);

  const loadAvailability = useCallback(async () => {
    if (IS_DEMO) {
      setAvail({
        settings: DEMO.settings,
        holidays: DEMO.holidays,
        openDates: DEMO.openDates,
        blocked: DEMO.blocked,
        taken: DEMO.taken,
        otTaken: DEMO.otTaken,
      });
      return;
    }
    const { data, error } = await supabase.rpc('ot_get_availability', {
      p_from: range.from,
      p_to: range.to,
    });
    if (error) {
      console.warn('[ot] availability:', error.message);
      return;
    }
    setAvail({
      settings: data?.settings || [],
      holidays: data?.holidays || [],
      openDates: data?.open_dates || [],
      blocked: data?.blocked || [],
      taken: data?.taken || [],
      otTaken: data?.ot_taken || [],
    });
  }, [range]);

  useEffect(() => {
    (async () => {
      await loadLink();
      setPhase((p) => (p === 'loading' ? 'main' : p));
    })();
  }, [loadLink]);

  useEffect(() => {
    if (IS_DEMO && (DEMO_PHASE === 'date' || DEMO_PHASE === 'time')) loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (phase === 'date' && !avail) loadAvailability();
  }, [phase, avail, loadAvailability]);

  const openDates = useMemo(() => {
    if (!avail) return [];
    const out = [];
    for (let i = 0; i < LOOKAHEAD_DAYS; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const ymd = ymdFromDate(d);
      const resolved = resolveDateAvailability(avail.settings, ymd, {
        holidays: avail.holidays,
        openDates: avail.openDates,
      });
      if (isResolvedDateOpen(resolved)) {
        out.push({ ymd, dow: d.getDay(), hours: resolved.available_hours });
      }
    }
    return out;
  }, [avail]);

  const takenSet = useMemo(() => {
    const s = new Set();
    (avail?.taken || []).forEach((r) => s.add(`${String(r.date).slice(0, 10)}|${normalizeBlockTime(r.time)}`));
    (avail?.otTaken || []).forEach((r) => s.add(`${String(r.date).slice(0, 10)}|${normalizeBlockTime(r.time)}`));
    return s;
  }, [avail]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate || !avail) return [];
    const day = openDates.find((d) => d.ymd === selectedDate);
    if (!day) return [];
    return day.hours.map((h) => {
      const time = `${String(h).padStart(2, '0')}:00`;
      const blocked = isSlotBlocked(avail.blocked, selectedDate, time);
      const taken = takenSet.has(`${selectedDate}|${time}`);
      const bookable = isMemberAppBookingAllowed(selectedDate, time);
      return { time, disabled: blocked || taken || !bookable };
    });
  }, [selectedDate, avail, openDates, takenSet]);

  const remaining = link?.remaining ?? 0;
  const myBookings = link?.bookings || [];

  const submitBooking = async () => {
    if (!name.trim() || !selectedDate || !selectedTime || busy) return;
    setBusy(true);
    setNotice('');
    if (IS_DEMO) {
      const fake = { id: `demo-${Date.now()}`, date: selectedDate, time: selectedTime, name: name.trim(), status: 'confirmed' };
      setLink((prev) => ({
        ...prev,
        remaining: Math.max(0, (prev?.remaining ?? 2) - 1),
        bookings: [...(prev?.bookings || []), fake],
      }));
      setJustBooked(fake);
      setBusy(false);
      setPhase('done');
      return;
    }
    const { data, error } = await supabase.rpc('ot_book', {
      p_token: token,
      p_date: selectedDate,
      p_time: selectedTime,
      p_name: name.trim(),
    });
    if (error || !data?.ok) {
      const reason = data?.reason || error?.message || '';
      setNotice(
        reason === 'slot_taken'
          ? '방금 그 시간이 찼습니다. 다른 시간을 골라 주세요.'
          : reason === 'no_remaining'
            ? '남은 오티 횟수가 없습니다.'
            : `신청에 실패했습니다. 다시 시도해 주세요. (${reason})`
      );
      setBusy(false);
      await loadLink();
      return;
    }
    // 관리자 푸시 + 구글 캘린더 등록은 부가 동작 — 실패해도 신청은 유효
    try {
      if (data.block) await invokeOtBlockGoogleSync('INSERT', data.block);
    } catch (e) {
      console.warn('[ot] calendar sync:', e);
    }
    try {
      const pid = await fetchAdminOnesignalPlayerId();
      if (pid) {
        await invokeNotifyAdminEvents(pid, '새 오티 신청', `${name.trim()}님 - ${selectedDate} ${selectedTime}`);
      }
    } catch (e) {
      console.warn('[ot] admin push:', e);
    }
    await loadLink();
    setJustBooked({ date: selectedDate, time: selectedTime, name: name.trim() });
    setBusy(false);
    setPhase('done');
  };

  const cancelBooking = async (booking) => {
    if (busy) return;
    if (!isMemberAppCancellationAllowed({ date: String(booking.date).slice(0, 10), time: booking.time })) {
      setNotice(MEMBER_CANCEL_COACH_CONTACT_MESSAGE);
      return;
    }
    setBusy(true);
    setNotice('');
    if (IS_DEMO) {
      setLink((prev) => ({
        ...prev,
        remaining: (prev?.remaining ?? 0) + 1,
        bookings: (prev?.bookings || []).filter((b) => b.id !== booking.id),
      }));
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.rpc('ot_cancel', { p_token: token, p_booking_id: booking.id });
    if (error || !data?.ok) {
      setNotice(
        data?.reason === 'locked'
          ? MEMBER_CANCEL_COACH_CONTACT_MESSAGE
          : '취소에 실패했습니다. 다시 시도해 주세요.'
      );
      setBusy(false);
      return;
    }
    try {
      if (data.old_block) await invokeOtBlockGoogleSync('DELETE', null, data.old_block);
    } catch (e) {
      console.warn('[ot] calendar delete:', e);
    }
    try {
      const pid = await fetchAdminOnesignalPlayerId();
      if (pid) {
        await invokeNotifyAdminEvents(pid, '오티 신청 취소', `${booking.name}님 - ${String(booking.date).slice(0, 10)} ${booking.time} 취소되었습니다.`);
      }
    } catch (e) {
      console.warn('[ot] cancel push:', e);
    }
    await loadLink();
    setBusy(false);
  };

  const resetFlow = () => {
    setSelectedDate(null);
    setSelectedTime(null);
    setName('');
    setJustBooked(null);
    setNotice('');
    setPhase('main');
  };

  /** 공통 레이아웃 */
  const Shell = ({ children, showBack, onBack }) => (
    <div className="min-h-[100dvh] bg-white text-slate-900 flex flex-col">
      <header className="px-6 pt-8 pb-4 flex items-center justify-between max-w-md w-full mx-auto">
        {showBack ? (
          <button type="button" onClick={onBack} aria-label="뒤로" className="p-2 -ml-2 text-slate-500 active:text-slate-900">
            <ChevronLeft size={22} strokeWidth={1.5} />
          </button>
        ) : (
          <span className="w-[38px]" />
        )}
        <LabDotBrand variant="header" />
        <span className="w-[38px]" />
      </header>
      <main className="flex-1 flex flex-col px-6 pb-10 max-w-md w-full mx-auto">{children}</main>
    </div>
  );

  if (phase === 'loading') {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">확인 중…</div>
      </Shell>
    );
  }

  if (phase === 'invalid') {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-lg font-medium tracking-tight">
            {invalidReason === 'revoked' ? '사용이 끝난 링크입니다.' : '링크를 확인해 주세요.'}
          </p>
          <p className="text-sm text-slate-500 leading-relaxed">
            센터에서 받은 최신 링크로 다시 열어 주세요.
            <br />
            같은 안내가 계속되면 센터로 연락해 주세요.
          </p>
        </div>
      </Shell>
    );
  }

  if (phase === 'done' && (justBooked || IS_DEMO)) {
    const shown = justBooked || { date: DEMO_DATE, time: '15:00', name: '김오티' };
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <div className="w-14 h-14 rounded-full bg-[#064e3b] flex items-center justify-center">
            <Check size={28} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xl font-medium tracking-tight">오티 신청이 완료됐습니다.</p>
            <p className="mt-2 text-[15px] text-slate-600">
              {formatDateLabel(String(shown.date).slice(0, 10))} {shown.time}
            </p>
            <p className="mt-1 text-sm text-slate-400">센터에서 뵙겠습니다.</p>
          </div>
          <button
            type="button"
            onClick={resetFlow}
            className="w-full bg-[#064e3b] text-white font-semibold py-4 rounded-xl text-[15px] tracking-wide active:scale-[0.99] transition-all"
          >
            확인
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === 'date') {
    return (
      <Shell showBack onBack={() => setPhase('main')}>
        <p className="text-lg font-medium tracking-tight mb-1">희망 날짜를 골라 주세요.</p>
        <p className="text-sm text-slate-400 mb-6">앞으로 2주 안에서 고를 수 있습니다.</p>
        {!avail ? (
          <p className="text-sm text-slate-400">달력을 불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {openDates.map((d) => (
              <button
                key={d.ymd}
                type="button"
                onClick={() => {
                  setSelectedDate(d.ymd);
                  setPhase('time');
                }}
                className="bg-white border border-gray-200 rounded-2xl py-4 px-3 text-left active:border-[#064e3b] active:bg-emerald-50/40 transition-all"
              >
                <span className="block text-[15px] font-medium text-slate-900">{formatDateLabel(d.ymd)}</span>
              </button>
            ))}
          </div>
        )}
      </Shell>
    );
  }

  if (phase === 'time') {
    return (
      <Shell showBack onBack={() => setPhase('date')}>
        <p className="text-lg font-medium tracking-tight mb-1">{formatDateLabel(selectedDate)}</p>
        <p className="text-sm text-slate-400 mb-6">시간을 골라 주세요.</p>
        <div className="grid grid-cols-3 gap-3">
          {slotsForDate.map((s) => (
            <button
              key={s.time}
              type="button"
              disabled={s.disabled}
              onClick={() => {
                setSelectedTime(s.time);
                setPhase('name');
              }}
              className={`rounded-2xl py-4 text-center text-[15px] font-medium transition-all ${
                s.disabled
                  ? 'bg-gray-50 text-slate-300 line-through'
                  : 'bg-white border border-gray-200 text-slate-900 active:border-[#064e3b] active:bg-emerald-50/40'
              }`}
            >
              {s.time}
            </button>
          ))}
        </div>
        {slotsForDate.length === 0 && <p className="text-sm text-slate-400">이 날은 신청할 수 있는 시간이 없습니다.</p>}
      </Shell>
    );
  }

  if (phase === 'name') {
    return (
      <Shell showBack onBack={() => setPhase('time')}>
        <p className="text-lg font-medium tracking-tight mb-1">
          {formatDateLabel(selectedDate)} {selectedTime}
        </p>
        <p className="text-sm text-slate-400 mb-6">신청자 이름을 적어 주세요.</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          maxLength={20}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-[16px] text-slate-900 focus:border-[#064e3b] outline-none"
        />
        {notice && <p className="mt-3 text-sm text-red-500">{notice}</p>}
        <button
          type="button"
          disabled={!name.trim() || busy}
          onClick={submitBooking}
          className="mt-6 w-full bg-[#064e3b] text-white font-semibold py-4 rounded-xl text-[15px] tracking-wide active:scale-[0.99] transition-all disabled:opacity-40"
        >
          {busy ? '신청 중…' : '신청하기'}
        </button>
      </Shell>
    );
  }

  // main
  return (
    <Shell>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">
          <p className="text-2xl font-medium tracking-tight leading-snug">
            처음 수업을
            <br />
            직접 골라 보세요.
          </p>
          <p className="text-sm text-slate-400">
            남은 오티 {remaining}회 / 총 {link?.max_sessions ?? 2}회
          </p>
        </div>

        {myBookings.length > 0 && (
          <div className="mb-6 space-y-3">
            {myBookings.map((b) => {
              const canCancel = isMemberAppCancellationAllowed({ date: String(b.date).slice(0, 10), time: b.time });
              return (
                <div key={b.id} className="border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-medium text-slate-900">
                      {formatDateLabel(String(b.date).slice(0, 10))} {b.time}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock size={12} strokeWidth={1.5} /> 신청 완료
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => cancelBooking(b)}
                    className={`text-sm font-medium px-3 py-2 rounded-lg ${
                      canCancel ? 'text-slate-500 active:bg-gray-100' : 'text-slate-300'
                    }`}
                  >
                    취소
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {notice && <p className="mb-4 text-sm text-red-500 text-center">{notice}</p>}

        {remaining > 0 ? (
          <button
            type="button"
            onClick={() => setPhase('date')}
            className="w-full bg-[#064e3b] text-white font-semibold py-5 rounded-2xl text-lg tracking-wide shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Calendar size={22} strokeWidth={1.5} />
            오티 신청
          </button>
        ) : (
          <div className="text-center border border-gray-200 rounded-2xl p-6">
            <p className="text-[15px] font-medium text-slate-900">오티가 끝났습니다.</p>
            <p className="mt-1 text-sm text-slate-400">정규 등록은 센터에서 안내드립니다.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
