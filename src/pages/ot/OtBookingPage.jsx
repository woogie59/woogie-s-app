import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
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

const DEEP_GREEN = '#064e3b';
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 검토용 데모 (?demo=1): 서버 없이 화면만 재생. 어떤 쓰기도 일어나지 않는다. */
const DEMO_PARAMS = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const IS_DEMO = DEMO_PARAMS?.get('demo') === '1';
/** 데모 전용: 특정 단계로 바로 열기 (?demo=1&phase=date|time|confirm|done|bookings|invalid) */
const DEMO_PHASE = IS_DEMO ? DEMO_PARAMS?.get('phase') || '' : '';

const DEMO = {
  link: { ok: true, member_name: '김오티', max_sessions: 2, remaining: 2, bookings: [] },
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
  member_name: '김오티',
  max_sessions: 2,
  remaining: 1,
  bookings: [{ id: 'demo-1', date: DEMO_DATE_LATER, time: '14:00', name: '김오티', status: 'confirmed' }],
};

/** 데모 전용: 소진 상태 합성 (?demo=1&demo_state=full_confirmed|full_completed) — 서버 쓰기 없음 */
const DEMO_STATE = IS_DEMO ? DEMO_PARAMS?.get('demo_state') || '' : '';
const DEMO_LINK_FULL_CONFIRMED = {
  ok: true,
  member_name: '김오티',
  max_sessions: 2,
  remaining: 0,
  bookings: [
    { id: 'demo-1', date: DEMO_DATE, time: '14:00', name: '김오티', status: 'confirmed' },
    { id: 'demo-2', date: DEMO_DATE_LATER, time: '15:00', name: '김오티', status: 'confirmed' },
  ],
};
const DEMO_LINK_FULL_COMPLETED = {
  ...DEMO_LINK_FULL_CONFIRMED,
  bookings: DEMO_LINK_FULL_CONFIRMED.bookings.map((b) => ({ ...b, status: 'completed' })),
};
const DEMO_LINK_PT_REQUESTED = {
  ...DEMO_LINK_FULL_COMPLETED,
  pt_request: { id: 'demo-pt-1', date: DEMO_DATE_LATER, time: '15:00', status: 'requested' },
};
const DEMO_LINK_PT_ACCEPTED = {
  ...DEMO_LINK_FULL_COMPLETED,
  pt_request: { id: 'demo-pt-1', date: DEMO_DATE_LATER, time: '15:00', status: 'accepted' },
};

/** 월 달력 격자: 해당 월의 날짜 셀 배열 (앞쪽 빈 칸 포함) */
function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  return cells;
}

export default function OtBookingPage({ token }) {
  const [phase, setPhase] = useState(() => (['date', 'time', 'confirm', 'done', 'invalid'].includes(DEMO_PHASE) ? DEMO_PHASE : 'loading')); // loading | invalid | main | date | time | confirm | done
  const [invalidReason, setInvalidReason] = useState('');
  const [link, setLink] = useState(null); // { member_name, remaining, max_sessions, bookings }
  const [availByMonth, setAvailByMonth] = useState({}); // { 'YYYY-MM': {settings, holidays, openDates, blocked, taken, otTaken} }
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDate, setSelectedDate] = useState(() => (DEMO_PHASE === 'time' || DEMO_PHASE === 'confirm' ? DEMO_DATE : null));
  const [selectedTime, setSelectedTime] = useState(() => (DEMO_PHASE === 'confirm' ? '15:00' : null));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [ptFlow, setPtFlow] = useState(false);
  const [justBooked, setJustBooked] = useState(null);

  const memberName = link?.member_name || '회원';

  const loadLink = useCallback(async () => {
    if (IS_DEMO) {
      const fixture =
        DEMO_STATE === 'full_confirmed'
          ? DEMO_LINK_FULL_CONFIRMED
          : DEMO_STATE === 'full_completed'
            ? DEMO_LINK_FULL_COMPLETED
            : DEMO_STATE === 'pt_requested'
              ? DEMO_LINK_PT_REQUESTED
              : DEMO_STATE === 'pt_accepted'
                ? DEMO_LINK_PT_ACCEPTED
                : DEMO_PHASE === 'bookings'
                  ? DEMO_LINK_WITH_BOOKING
                  : DEMO.link;
      setLink((prev) => prev || { ...fixture });
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

  const loadMonthAvailability = useCallback(async (monthKey) => {
    if (IS_DEMO) {
      setAvailByMonth((prev) => (prev[monthKey] ? prev : { ...prev, [monthKey]: { ...DEMO, link: undefined } }));
      return;
    }
    const [y, m] = monthKey.split('-').map((v) => parseInt(v, 10));
    const from = `${monthKey}-01`;
    const to = ymdFromDate(new Date(y, m, 0)); // 월말
    const { data, error } = await supabase.rpc('ot_get_availability', { p_from: from, p_to: to });
    if (error) {
      console.warn('[ot] availability:', error.message);
      return;
    }
    setAvailByMonth((prev) => ({
      ...prev,
      [monthKey]: {
        settings: data?.settings || [],
        holidays: data?.holidays || [],
        openDates: data?.open_dates || [],
        blocked: data?.blocked || [],
        taken: data?.taken || [],
        otTaken: data?.ot_taken || [],
      },
    }));
  }, []);

  useEffect(() => {
    (async () => {
      await loadLink();
      setPhase((p) => (p === 'loading' ? 'main' : p));
    })();
  }, [loadLink]);

  useEffect(() => {
    if (IS_DEMO && (DEMO_PHASE === 'date' || DEMO_PHASE === 'time')) loadMonthAvailability(viewMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMonthAvailability]);

  useEffect(() => {
    if (phase === 'date' && !availByMonth[viewMonth]) loadMonthAvailability(viewMonth);
  }, [phase, viewMonth, availByMonth, loadMonthAvailability]);

  const monthOf = (ymd) => ymd?.slice(0, 7);
  const availFor = useCallback((ymd) => availByMonth[monthOf(ymd)] || null, [availByMonth]);

  const takenSetFor = useCallback((ymd) => {
    const a = availFor(ymd);
    const s = new Set();
    (a?.taken || []).forEach((r) => s.add(`${String(r.date).slice(0, 10)}|${normalizeBlockTime(r.time)}`));
    (a?.otTaken || []).forEach((r) => s.add(`${String(r.date).slice(0, 10)}|${normalizeBlockTime(r.time)}`));
    return s;
  }, [availFor]);

  /** 그 날 신청 가능한 정시가 하나라도 있는지 */
  const hasFreeSlot = useCallback((ymd) => {
    const a = availFor(ymd);
    if (!a) return false;
    const resolved = resolveDateAvailability(a.settings, ymd, { holidays: a.holidays, openDates: a.openDates });
    if (!isResolvedDateOpen(resolved)) return false;
    const taken = takenSetFor(ymd);
    return resolved.available_hours.some((h) => {
      const time = `${String(h).padStart(2, '0')}:00`;
      if (isSlotBlocked(a.blocked, ymd, time)) return false;
      if (taken.has(`${ymd}|${time}`)) return false;
      return isMemberAppBookingAllowed(ymd, time);
    });
  }, [availFor, takenSetFor]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const a = availFor(selectedDate);
    if (!a) return [];
    const resolved = resolveDateAvailability(a.settings, selectedDate, { holidays: a.holidays, openDates: a.openDates });
    if (!isResolvedDateOpen(resolved)) return [];
    const taken = takenSetFor(selectedDate);
    return resolved.available_hours.map((h) => {
      const time = `${String(h).padStart(2, '0')}:00`;
      const disabled = isSlotBlocked(a.blocked, selectedDate, time) || taken.has(`${selectedDate}|${time}`) || !isMemberAppBookingAllowed(selectedDate, time);
      return { time, disabled };
    });
  }, [selectedDate, availFor, takenSetFor]);

  const remaining = link?.remaining ?? 0;
  const myBookings = link?.bookings || [];
  // 예약(confirmed)과 출석 소진(completed) 분리: '오티 끝' 안내는 전부 출석 완료 후에만
  const allSessionsCompleted =
    remaining === 0 && myBookings.length > 0 && myBookings.every((b) => b.status === 'completed');

  const ptRequest = link?.pt_request || null;

  const submitPtRequest = async () => {
    if (!selectedDate || !selectedTime || busy) return;
    setBusy(true);
    setNotice('');
    if (IS_DEMO) {
      setLink((prev) => ({ ...prev, pt_request: { id: 'demo-pt-1', date: selectedDate, time: selectedTime, status: 'requested' } }));
      setJustBooked({ date: selectedDate, time: selectedTime, name: memberName });
      setBusy(false);
      setPhase('done');
      return;
    }
    const { data, error } = await supabase.rpc('ot_request_pt', {
      p_token: token,
      p_date: selectedDate,
      p_time: selectedTime,
    });
    if (error || !data?.ok) {
      const reason = data?.reason || error?.message || '';
      setNotice(
        reason === 'slot_taken'
          ? '그 시간은 이미 차 있습니다. 다른 시간을 골라 주세요.'
          : reason === 'already_requested'
            ? '이미 신청이 접수되어 있습니다.'
            : reason === 'not_completed'
              ? '오티 출석이 모두 완료된 후 신청할 수 있습니다.'
              : reason === 'too_soon'
                ? '시작 1시간 전부터는 신청할 수 없습니다.'
                : '신청에 실패했습니다. 다시 시도해 주세요.'
      );
      setBusy(false);
      await loadLink();
      return;
    }
    await loadLink();
    setJustBooked({ date: selectedDate, time: selectedTime, name: memberName });
    setBusy(false);
    setPhase('done');
  };

  const cancelPtRequest = async () => {
    if (busy || !ptRequest?.id) return;
    setBusy(true);
    setNotice('');
    if (IS_DEMO) {
      setLink((prev) => ({ ...prev, pt_request: null }));
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.rpc('ot_cancel_pt_request', { p_token: token, p_request_id: ptRequest.id });
    if (error || !data?.ok) {
      setNotice('취소에 실패했습니다. 다시 시도해 주세요.');
      setBusy(false);
      return;
    }
    await loadLink();
    setBusy(false);
  };

  const submitBooking = async () => {
    if (!selectedDate || !selectedTime || busy) return;
    setBusy(true);
    setNotice('');
    if (IS_DEMO) {
      const fake = { id: `demo-${Date.now()}`, date: selectedDate, time: selectedTime, name: memberName, status: 'confirmed' };
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
    });
    if (error || !data?.ok) {
      const reason = data?.reason || error?.message || '';
      setNotice(
        reason === 'slot_taken'
          ? '방금 그 시간이 찼습니다. 다른 시간을 골라 주세요.'
          : reason === 'no_remaining'
            ? '남은 오티 횟수가 없습니다.'
            : reason === 'too_soon'
              ? '수업 1시간 전부터는 앱에서 신청할 수 없습니다.'
              : '신청에 실패했습니다. 다시 시도해 주세요.'
      );
      setBusy(false);
      await loadLink();
      return;
    }
    // 알림·캘린더는 이 공개 페이지에서 직접 외부를 호출하지 않는다.
    // (기존 공개 Edge는 임의 대상/문구 호출이 가능해 무로그인 페이지에 연결하지 않음)
    // 서버 검증형 알림·캘린더는 DB webhook + ot-booking-notify 함수로 대체 예정
    // (배포 전까지는 관리자 화면 배지 + 수동 재시도로 복구).
    await loadLink();
    setJustBooked({ date: selectedDate, time: selectedTime, name: memberName });
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
    await loadLink();
    setBusy(false);
  };

  const resetFlow = () => {
    setPtFlow(false);
    setSelectedDate(null);
    setSelectedTime(null);
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
    const shown = justBooked || { date: DEMO_DATE, time: '15:00', name: memberName };
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <div className="w-14 h-14 rounded-full bg-[#064e3b] flex items-center justify-center">
            <Check size={28} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xl font-medium tracking-tight">
              {ptFlow ? '피티 등록 신청이 접수됐습니다.' : `${shown.name}님, 오티 신청이 완료됐습니다.`}
            </p>
            <p className="mt-2 text-[15px] text-slate-600">
              {formatDateLabel(String(shown.date).slice(0, 10))} {shown.time}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {ptFlow ? '센터에서 검토 후 확정 안내를 드립니다.' : '센터에서 뵙겠습니다.'}
            </p>
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
    const [vy, vm] = viewMonth.split('-').map((v) => parseInt(v, 10));
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayYmd = ymdFromDate(now);
    const monthLoaded = Boolean(availByMonth[viewMonth]);
    const moveMonth = (delta) => {
      const d = new Date(vy, vm - 1 + delta, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      setViewMonth(key);
      if (!availByMonth[key]) loadMonthAvailability(key);
    };
    return (
      <Shell showBack onBack={() => setPhase('main')}>
        <p className="text-lg font-medium tracking-tight mb-1">희망 날짜를 골라 주세요.</p>
        <p className="text-sm text-slate-400 mb-5">수업이 열리는 날만 고를 수 있습니다.</p>

        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            aria-label="이전 달"
            disabled={viewMonth <= thisMonthKey}
            onClick={() => moveMonth(-1)}
            className={`p-2 ${viewMonth <= thisMonthKey ? 'text-slate-200' : 'text-slate-500 active:text-slate-900'}`}
          >
            <ChevronLeft size={20} strokeWidth={1.5} />
          </button>
          <p className="text-[15px] font-semibold tracking-tight">{vy}년 {vm}월</p>
          <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)} className="p-2 text-slate-500 active:text-slate-900">
            <ChevronRight size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">
          {DAY_LABELS.map((d) => <span key={d} className="py-1">{d}</span>)}
        </div>
        {!monthLoaded ? (
          <p className="text-sm text-slate-400 text-center py-10">달력을 불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {monthCells(vy, vm - 1).map((cell, i) => {
              if (!cell) return <span key={`empty-${i}`} />;
              const ymd = ymdFromDate(cell);
              const enabled = ymd >= todayYmd && hasFreeSlot(ymd);
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={!enabled}
                  onClick={() => {
                    setSelectedDate(ymd);
                    setPhase('time');
                  }}
                  className={`aspect-square rounded-xl text-[15px] font-medium transition-all ${
                    enabled
                      ? 'text-slate-900 active:bg-[#064e3b] active:text-white'
                      : 'text-slate-300'
                  }`}
                >
                  {cell.getDate()}
                </button>
              );
            })}
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
                setPhase('confirm');
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

  if (phase === 'confirm') {
    return (
      <Shell showBack onBack={() => setPhase('time')}>
        <p className="text-lg font-medium tracking-tight mb-1">{ptFlow ? '피티 등록 신청' : `${memberName}님의 오티`}</p>
        <p className="text-sm text-slate-400 mb-6">
          {ptFlow ? '첫 PT 희망 일시로 신청합니다. 센터 검토 후 확정 안내를 드립니다.' : '아래 시간으로 신청합니다.'}
        </p>
        <div className="border border-gray-200 rounded-2xl p-5 text-center">
          <p className="text-xl font-semibold tracking-tight">
            {formatDateLabel(selectedDate)} {selectedTime}
          </p>
        </div>
        {notice && <p className="mt-3 text-sm text-red-500">{notice}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={ptFlow ? submitPtRequest : submitBooking}
          className="mt-6 w-full bg-[#064e3b] text-white font-semibold py-4 rounded-xl text-[15px] tracking-wide active:scale-[0.99] transition-all disabled:opacity-40"
        >
          {busy ? '신청 중…' : '이 일시로 신청하기'}
        </button>
      </Shell>
    );
  }

  // main (환영)
  return (
    <Shell>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">
          <p className="text-2xl font-medium tracking-tight leading-snug">
            {memberName}님,
            <br />
            환영합니다.
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
                      <Clock size={12} strokeWidth={1.5} /> {b.status === 'completed' ? '출석 완료' : '신청 완료'}
                    </p>
                  </div>
                  {b.status !== 'completed' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setCancelTarget(b)}
                      className={`text-sm font-medium px-3 py-2 rounded-lg ${
                        canCancel ? 'text-slate-500 active:bg-gray-100' : 'text-slate-300'
                      }`}
                    >
                      취소
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {notice && <p className="mb-4 text-sm text-red-500 text-center">{notice}</p>}

        {remaining > 0 ? (
          <button
            type="button"
            onClick={() => {
              setPtFlow(false);
              setPhase('date');
            }}
            className="w-full bg-[#064e3b] text-white font-semibold py-5 rounded-2xl text-lg tracking-wide shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Calendar size={22} strokeWidth={1.5} />
            오티 신청
          </button>
        ) : allSessionsCompleted ? (
          <div className="text-center border border-gray-200 rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-[15px] font-medium text-slate-900">오티 출석이 모두 완료됐습니다.</p>
              <p className="mt-1 text-sm text-slate-400">수고하셨습니다.</p>
            </div>
            {!ptRequest && (
              <button
                type="button"
                onClick={() => {
                  setPtFlow(true);
                  setPhase('date');
                }}
                className="w-full bg-[#064e3b] text-white font-semibold py-4 rounded-xl text-[15px] tracking-wide active:scale-[0.99] transition-all"
              >
                피티 등록 신청
              </button>
            )}
            {ptRequest?.status === 'requested' && (
              <div className="space-y-3">
                <div>
                  <p className="text-[15px] font-medium text-slate-900">피티 등록 신청을 접수했어요.</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateLabel(String(ptRequest.date).slice(0, 10))} {ptRequest.time} · 센터 검토 중
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelPtRequest}
                  className="text-sm text-slate-400 underline underline-offset-2 disabled:opacity-40"
                >
                  신청 취소
                </button>
              </div>
            )}
            {ptRequest?.status === 'accepted' && (
              <div>
                <p className="text-[15px] font-medium text-slate-900">센터가 신청을 확인했어요.</p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDateLabel(String(ptRequest.date).slice(0, 10))} {ptRequest.time}
                </p>
                <p className="mt-1 text-sm text-slate-400">시간 확정은 센터에서 별도로 안내드립니다.</p>
              </div>
            )}
            {ptRequest?.status === 'declined' && (
              <div className="space-y-3">
                <div>
                  <p className="text-[15px] font-medium text-slate-900">신청하신 일시는 어렵습니다.</p>
                  <p className="mt-1 text-sm text-slate-400">다른 일시로 다시 신청하시거나 센터 안내를 기다려 주세요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPtFlow(true);
                    setPhase('date');
                  }}
                  className="w-full bg-[#064e3b] text-white font-semibold py-4 rounded-xl text-[15px] tracking-wide active:scale-[0.99] transition-all"
                >
                  다른 일시로 다시 신청
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-slate-400">예약된 오티 출석이 끝나면 다음 단계를 안내드릴게요.</p>
        )}
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-[15px] font-medium text-slate-900">
              {formatDateLabel(String(cancelTarget.date).slice(0, 10))} {cancelTarget.time}
            </p>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              이 오티 신청을 취소할까요?
              <br />
              자리는 바로 열리고 횟수는 돌아갑니다.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelTarget(null)}
                className="flex-1 border border-gray-200 text-slate-600 font-medium py-3 rounded-xl text-[15px] active:bg-gray-50"
              >
                돌아가기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const target = cancelTarget;
                  setCancelTarget(null);
                  await cancelBooking(target);
                }}
                className="flex-1 bg-[#064e3b] text-white font-semibold py-3 rounded-xl text-[15px] active:scale-[0.99] transition-all disabled:opacity-40"
              >
                {busy ? '취소 중…' : '취소하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
