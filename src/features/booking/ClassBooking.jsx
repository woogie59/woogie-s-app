import OneSignal from 'react-onesignal';
import SlotAlertCard from '../../components/member/SlotAlertCard';
import { useDesignRefinement, formatBookingDateKo } from '../design/designRefinement';
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import Skeleton from '../../components/ui/Skeleton';
import { Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  computeRemainingSessions,
  countScheduledSessionsForBalance,
  fetchSessionBalanceMetrics,
  logBoundaryMathCheck,
} from '../../utils/sessionHelpers';
import { useGlobalModal } from '../../context/GlobalModalContext';
import BackButton from '../../components/ui/BackButton';
import MemberCancelBookingModals from '../../components/member/MemberCancelBookingModals';
import { emitSessionBalanceRefresh } from '../../utils/sessionBalanceEvents';
import {
  isMemberAppBookingAllowed,
  isNextWeekBookingUnlockedKST, isNewMemberUiEnabled,
  isSlotTooSoonForMemberBooking,
  MEMBER_BOOKING_ONE_HOUR_MESSAGE,
  NEXT_WEEK_LOCKED_BANNER_HTML,
  NEXT_WEEK_LOCKED_TOAST_MESSAGE,
} from '../../utils/bookingDateKeys';
import {
  getBookingInitialPwaState,
  writeBookingPwaToSessionAndUrl,
  stripBookingPwaFromUrl,
} from '../../utils/bookingPwaState';
import { isSlotBlocked } from '../../utils/trainerBlockedSlots';
import {
  isResolvedDateOpen,
  resolveDateAvailability,
} from '../../utils/labdotWeekSchedulePolicy';

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

/** Hour 0–23 from "HH:mm" time slot */
function slotHourFromTime(time) {
  const [h] = String(time).split(':').map(Number);
  return Number.isFinite(h) ? h : -1;
}

const ClassBooking = ({ user, profileName = '', setView, goBack }) => {
  const { enabled: refined } = useDesignRefinement();
  const { showAlert, showConfirm, showToast, closeModal } = useGlobalModal();
  const profileNameResolvedRef = useRef(false);
  /** sessionStorage 1순 (과제) + 동기 초기화 — '오늘' 기본값으로 덮지 않음 */
  const [selectedDate, setSelectedDate] = useState(() => getBookingInitialPwaState(user?.id).selectedDate);
  const [weekMode, setWeekMode] = useState(() => getBookingInitialPwaState(user?.id).weekMode);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [slotAlertOpenTick, setSlotAlertOpenTick] = useState(0);
  const [settings, setSettings] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [openDates, setOpenDates] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [availabilityReadError, setAvailabilityReadError] = useState(false);
  /** Non-blocking toast when next week is still locked */
  const [weekToast, setWeekToast] = useState(null);
  /** 내 예약 슬롯·티켓 탭 → 공통 취소 모달 */
  const [cancelIntent, setCancelIntent] = useState(null);
  const [slotAlertsEnabled, setSlotAlertsEnabled] = useState(false);
  const [slotAlerts, setSlotAlerts] = useState({});
  const [slotAlertBusy, setSlotAlertBusy] = useState(null);
  const [slotAlertReadError, setSlotAlertReadError] = useState(false);
  /** 전체 예약(캘린더 점 + 다가오는 일정) — 본인 행만 */
  const [myAllBookings, setMyAllBookings] = useState([]);
  /** 2h 취소 잠금 경계 UI 갱신 */
  const [memberCancelUiTick, setMemberCancelUiTick] = useState(0);

  const now = useMemo(() => new Date(), []);
  const thisMonday = useMemo(() => getMonday(now), [now]);
  const nextMonday = useMemo(() => addDays(thisMonday, 7), [thisMonday]);

  const activeWeekStart = weekMode === 'current' ? thisMonday : nextMonday;

  const [nextWeekLockTick, setNextWeekLockTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNextWeekLockTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const nextUnlocked = useMemo(
    () => isNextWeekBookingUnlockedKST(new Date(), profileName),
    [nextWeekLockTick, profileName],
  );

  useLayoutEffect(() => {
    if (!user?.id || profileName == null) return;
    if (profileNameResolvedRef.current) return;
    profileNameResolvedRef.current = true;
    const restored = getBookingInitialPwaState(user.id, profileName);
    setWeekMode(restored.weekMode);
    setSelectedDate(restored.selectedDate);
  }, [user?.id, profileName]);

  const fetchMyAllBookings = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (error) setMyAllBookings([]);
    else setMyAllBookings(Array.isArray(data) ? data : []);
  }, [user?.id]);

  useEffect(() => {
    fetchMyAllBookings();
  }, [fetchMyAllBookings]);

  useEffect(() => {
    const id = window.setInterval(() => setMemberCancelUiTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const myDatesWithBooking = useMemo(() => {
    const s = new Set();
    (myAllBookings || []).forEach((b) => {
      if (b?.date) s.add(b.date);
    });
    return s;
  }, [myAllBookings]);

  const weekDates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      arr.push(addDays(activeWeekStart, i));
    }
    return arr;
  }, [activeWeekStart]);

  const weekDateKeys = useMemo(() => weekDates.map((d) => toDateKey(d)), [weekDates]);
  const todayKey = toDateKey(new Date());

  /**
   * Task 2: mount 시 `sessionStorage`·URL(`getBookingInitialPwaState`)을 **먼저** 반영
   * (user 변경 시에도 동일)
   */
  useLayoutEffect(() => {
    if (!user?.id) return;
    const s = getBookingInitialPwaState(user.id);
    setWeekMode(s.weekMode);
    setSelectedDate(s.selectedDate);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    writeBookingPwaToSessionAndUrl(user.id, { weekMode, selectedDate });
  }, [user?.id, weekMode, selectedDate]);

  useLayoutEffect(() => {
    if (!selectedDate) return;
    if (!weekDateKeys.includes(selectedDate) || selectedDate < todayKey) {
      setSelectedDate(null);
    }
  }, [selectedDate, weekDateKeys, todayKey]);

  /** 예약 화면 이탈 시 URL `?date=&week=` 정리(홈 PWA는 쿼리 없이) */
  useEffect(() => {
    return () => {
      stripBookingPwaFromUrl();
    };
  }, []);

  // A notification may be tapped while this screen is already mounted.
  useEffect(() => {
    const open = () => {
      const restored = getBookingInitialPwaState(user?.id, profileName);
      setWeekMode(restored.weekMode);
      setSelectedDate(restored.selectedDate);
      setSlotAlertOpenTick((n) => n + 1);
      fetchMyAllBookings();
    };
    window.addEventListener('labdot-slot-alert-open', open);
    return () => window.removeEventListener('labdot-slot-alert-open', open);
  }, [user?.id, profileName, fetchMyAllBookings]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('trainer_settings').select('*').order('day_of_week');
      setSettings(error ? [] : data || []);
    };
    const fetchHolidays = async () => {
      const { data, error } = await supabase.from('trainer_holidays').select('date');
      setHolidays(error ? [] : (data || []).map((h) => String(h.date).slice(0, 10)));
    };
    const fetchOpenDates = async () => {
      const { data, error } = await supabase.from('trainer_open_dates').select('date, available_hours');
      setOpenDates(error ? [] : data || []);
    };
    fetchSettings();
    fetchHolidays();
    fetchOpenDates();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let live = true;
    const fetchBookings = async () => {
      setLoading(true);
      setAvailabilityReadError(false);
      try {
        const [bookingsRes, blocksRes] = await Promise.all([
          supabase.from('bookings').select('*').eq('date', selectedDate),
          // 최소 읽기: 날짜·시간·kind만 (후보 migration 20261023180000 적용 후 동작)
          supabase.rpc('get_blocked_slots_public', { p_date: selectedDate }),
        ]);
        if (!live) return;
        if (bookingsRes.error) throw bookingsRes.error;
        if (blocksRes.error) throw blocksRes.error;
        if (!Array.isArray(bookingsRes.data) || !Array.isArray(blocksRes.data)) throw new Error('invalid_availability');
        setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
        setBlockedSlots(blocksRes.data);
      } catch {
        if (!live) return;
        setAvailabilityReadError(true);
        setBookings([]);
        setBlockedSlots([]);
      } finally {
        if (live) setLoading(false);
      }
    };
    fetchBookings();
    return () => { live = false; };
  }, [selectedDate, slotAlertOpenTick]);

  useEffect(() => {
    if (!weekToast) return;
    const t = setTimeout(() => setWeekToast(null), 3800);
    return () => clearTimeout(t);
  }, [weekToast]);

  const countSlot = (dateStr, time) => bookings.filter((b) => b.date === dateStr && b.time === time).length;

  const getDaySetting = (dateStr) =>
    resolveDateAvailability(settings, dateStr, { holidays, openDates });

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
    if (getDaySetting(dateStr).off) return [];

    const hours = getDaySetting(dateStr).available_hours || [];
    return hours.map((h) => `${String(h).padStart(2, '0')}:00`);
  }, [selectedDate, settings, holidays, openDates]);

  const slotRemaining = (time) => Math.max(0, MAX_PER_SLOT - countSlot(selectedDate, time));

  const isSlotBookable = (time) => {
    if (!selectedDate || loading || availabilityReadError) return false;
    if (getDaySetting(selectedDate).off) return false;
    if (!isHourInAvailableMatrix(selectedDate, time)) return false;
    if (isSlotBlocked(blockedSlots, selectedDate, time)) return false;
    if (isSlotExpired(selectedDate, time)) return false;
    return slotRemaining(time) > 0;
  };

  const handleBookSlot = (timeSlot) => {
    if (isSlotTooSoonForMemberBooking(selectedDate, timeSlot)) {
      showAlert({ message: MEMBER_BOOKING_ONE_HOUR_MESSAGE, confirmLabel: '확인' });
      return;
    }
    if (!isSlotBookable(timeSlot)) return;
    const date = selectedDate;
    showConfirm({
      centeredDialog: true,
      title: '수업 예약',
      message: `${refined ? formatBookingDateKo(date, timeSlot) : `${date} ${timeSlot}`} 수업을 예약하시겠습니까?`,
      confirmLabel: '예약확인',
      onConfirm: async () => {
        if (!isMemberAppBookingAllowed(date, timeSlot)) {
          showAlert({ message: MEMBER_BOOKING_ONE_HOUR_MESSAGE, confirmLabel: '확인' });
          return;
        }
        // Recheck after confirmation: another member or OT may have taken the slot.
        const [freshBookings, freshBlocks] = await Promise.all([
          supabase.from('bookings').select('id, date, time, status').eq('date', date),
          supabase.rpc('get_blocked_slots_public', { p_date: date }),
        ]);
        if (freshBookings.error || freshBlocks.error || !Array.isArray(freshBookings.data) || !Array.isArray(freshBlocks.data)) {
          showAlert({ message: '예약 가능 시간을 확인하지 못했습니다. 다시 확인해 주세요.', confirmLabel: '확인' });
          return;
        }
        if (isSlotBlocked(freshBlocks.data, date, timeSlot) || freshBookings.data.some((b) => b.status !== 'cancelled' && String(b.time).slice(0, 5) === timeSlot)) {
          setSlotAlertOpenTick((n) => n + 1);
          showAlert({ message: '이미 마감된 시간입니다. 다른 시간을 선택해 주세요.', confirmLabel: '확인' });
          return;
        }
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
          if (error.code === '23505' || /slot_taken/.test(error.message || '')) {
            setSlotAlertOpenTick((n) => n + 1);
            showAlert({ message: '이미 마감된 시간입니다. 다른 시간을 선택해 주세요.', confirmLabel: '확인' });
            return;
          }
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
        if (refined) { closeModal(); showToast('예약이 완료되었습니다.'); }
        else showAlert({ message: '예약이 완료되었습니다!', confirmLabel: '확인' });
        const { data: updated } = await supabase.from('bookings').select('*').eq('date', date);
        setBookings(updated || []);
        fetchMyAllBookings();
        // 관리자 푸시는 서버(bookings 트리거 → booking-admin-notify outbox)가 발송 - 클라이언트 발송 제거됨.
      },
    });
  };

  const syncAfterBookingChange = useCallback(async () => {
    if (selectedDate) {
      const { data: updated, error } = await supabase.from('bookings').select('*').eq('date', selectedDate);
      if (error) setBookings([]);
      else setBookings(updated || []);
    }
    await fetchMyAllBookings();
    emitSessionBalanceRefresh();
  }, [selectedDate, fetchMyAllBookings]);

  // Server capability gate is fail-closed: unapproved members do not see the feature.
  useEffect(() => {
    let live = true;
    setSlotAlertsEnabled(false);
    supabase.rpc('slot_alert_capabilities').then(({ data, error }) => {
      if (live && !error) setSlotAlertsEnabled(data === true);
    });
    return () => { live = false; };
  }, [user?.id]);

  const refreshSlotAlerts = useCallback(async () => {
    if (!slotAlertsEnabled || !selectedDate || !user?.id) return;
    const { data, error } = await supabase.from('slot_alert_requests')
      .select('id, slot_time, state').eq('user_id', user.id).eq('slot_date', selectedDate)
      .in('state', ['active', 'queued']);
    setSlotAlertReadError(Boolean(error));
    if (error) return;
    const map = {};
    (data || []).forEach((r) => { map[r.slot_time] = r; });
    setSlotAlerts(map);
  }, [slotAlertsEnabled, selectedDate, user?.id]);

  useEffect(() => {
    setSlotAlerts({});
    refreshSlotAlerts();
    const onFocus = () => refreshSlotAlerts();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshSlotAlerts]);

  const handleSlotAlert = (time) => {
    if (slotAlertBusy || slotAlertReadError) return;
    const existing = slotAlerts[time];
    const date = selectedDate;
    const dateLabel = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 ${time}`;
    showConfirm({
      centeredDialog: true,
      title: existing ? '빈자리 알림 해제' : '빈자리 알림 받기',
      message: existing
        ? `${dateLabel} 알림을 해제하시겠습니까? 이미 발송 중인 알림은 도착할 수 있습니다.`
        : `${dateLabel}\n\n빈자리가 생기면 알림을 보내드립니다. 자동 예약은 아니며, 알림 확인 후 직접 예약해주세요. 다른 알림신청자에게도 알림이 갑니다.`,
      confirmLabel: existing ? '알림 해제' : '알림 신청',
      onConfirm: async () => {
        setSlotAlertBusy(time);
        try {
          if (!existing && !OneSignal.User?.PushSubscription?.optedIn) {
            showAlert({ message: '휴대폰에서 LAB DOT 푸시 알림을 먼저 허용해 주세요. 알림 허용 후 다시 신청할 수 있습니다. 빈자리 알림은 아직 신청되지 않았습니다.' });
            await OneSignal.Slidedown.promptPush();
            return;
          }
          const { data, error } = existing
            ? await supabase.rpc('slot_alert_cancel', { p_id: existing.id })
            : await supabase.rpc('slot_alert_register', { p_date: date, p_time: time });
          if (error) throw error;
          if (!data?.ok) {
            const reasons = {
              already_available: '이미 빈자리가 생겼습니다. 예약 화면을 새로 확인해 주세요.',
              own_booking: '이미 본인이 예약한 시간입니다.',
              unavailable: '현재 알림 신청이 불가능한 시간입니다.',
              not_enabled: '아직 빈자리 알림 이용 대상이 아닙니다.',
              inactive: '회원 상태를 확인해 주세요.',
            };
            throw new Error(reasons[data?.reason] || '알림 신청 상태를 확인할 수 없습니다.');
          }
          await refreshSlotAlerts();
          showAlert({ message: existing
            ? (data.may_already_be_sending ? '해제했습니다. 이미 발송 중인 알림은 도착할 수 있습니다.' : '빈자리 알림을 해제했습니다.')
            : '빈자리 알림을 신청했습니다. 한 번 알려드리며, 직접 예약해야 확정됩니다.' });
        } catch (error) {
          showAlert({ message: `빈자리 알림 처리 실패: ${error?.message || '다시 시도해 주세요.'}` });
        } finally { setSlotAlertBusy(null); }
      },
    });
  };

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
    <div
      className="bg-gray-50 text-slate-900 flex flex-col max-w-full min-h-[100dvh] font-sans antialiased"
      data-lock-tick={memberCancelUiTick}
    >
      <div className="shrink-0 px-5 pt-6 pb-3 border-b border-gray-100/90 bg-gray-50">
        <BackButton onClick={goBack} />
        <header className="mt-4 mb-5">
          <h1 className="text-xl font-light text-slate-900 tracking-wide">수업 예약 및 일정</h1>
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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-5 pt-4 pb-2 overflow-hidden">
            <p className="text-xs font-bold text-gray-400 tracking-wider mb-3">날짜 선택</p>
            <div
              className={`flex gap-2 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 scrollbar-hide ${refined ? 'refinement-week' : ''}`}
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
                const hasMine = myDatesWithBooking.has(dateStr);
                const isWeekendDay = dow === 0 || dow === 6;
                const dateResolved = getDaySetting(dateStr);
                const isHolidayDate = dateResolved.source === 'holiday';
                const weekendOpen = isWeekendDay && !isPast && isResolvedDateOpen(dateResolved);
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => !isPast && setSelectedDate(dateStr)}
                    disabled={isPast}
                    className={`relative shrink-0 min-w-[52px] py-3 px-2 rounded-xl border flex flex-col items-center justify-center transition-all duration-200 active:scale-[0.98] ${
                      isSelected
                        ? 'bg-[#064e3b] border-[#064e3b] text-white shadow-md'
                        : isPast
                          ? 'bg-gray-100/80 border-transparent text-gray-300 cursor-not-allowed opacity-60'
                          : isHolidayDate
                            ? 'bg-red-50/80 border-red-100 text-red-700/90'
                            : hasMine
                              ? 'bg-white border-[#064e3b]/35 text-slate-700 ring-1 ring-[#064e3b]/15 shadow-sm'
                              : 'bg-white border-gray-100 text-slate-700 hover:border-gray-200 shadow-sm'
                    }`}
                  >
                    <span className="text-[10px] font-light tracking-widest uppercase opacity-80">{labelKo}</span>
                    <span className="text-lg font-light tabular-nums mt-0.5">{dayNum}</span>
                    {weekendOpen && (
                      <span
                        className={`mt-0.5 rounded px-1 py-px text-[8px] font-bold tracking-wide leading-none ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white'
                        }`}
                      >
                        OPEN
                      </span>
                    )}
                    {hasMine && (
                      <span
                        className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                          isSelected ? 'bg-white shadow-sm' : 'bg-[#064e3b]'
                        }`}
                        aria-hidden
                      />
                    )}
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
            className="flex-1 min-h-0 overflow-y-auto overscroll-y-none px-5 pb-safe pt-2 scrollable"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {selectedDate && (
              <>
                <p className="text-xs font-bold text-gray-400 tracking-wider mb-3">시간 선택</p>
                {getDaySetting(selectedDate).off ? (
                  <p className="text-center text-sm font-light text-gray-500 py-12 tracking-wide">휴무일입니다.</p>
                ) : loading ? (
                  refined ? <div role="status" aria-label="시간을 불러오는 중" className="grid grid-cols-3 gap-3">
                    {Array.from({ length: 9 }, (_, index) => <Skeleton key={index} className="h-14 rounded-xl" />)}
                  </div> : <p className="text-center text-sm text-gray-400 py-12 font-light">불러오는 중…</p>
                ) : availabilityReadError ? (
                  <div role="alert" className="text-center py-8 text-sm text-gray-600">
                    <p>예약 가능 시간을 확인하지 못했습니다.</p>
                    <button type="button" className="mt-3 underline p-3" onClick={() => setSlotAlertOpenTick((n) => n + 1)}>다시 확인</button>
                  </div>
                ) : generateTimeSlots().length === 0 ? (
                  <p className="text-center text-sm font-light text-gray-500 py-12">이 날짜에 열린 슬롯이 없습니다.</p>
                ) : (
                  <>
                  {slotAlertsEnabled && <p className="text-xs leading-5 text-gray-500 mb-3">빈자리 알림은 1회만 발송됩니다. 자동 예약되지 않으며, 먼저 직접 예약한 분이 확정됩니다.</p>}
                  {slotAlertsEnabled && slotAlertReadError && <button type="button" onClick={refreshSlotAlerts} className="text-xs text-red-700 underline mb-3">알림 신청 상태를 불러오지 못했습니다. 다시 확인</button>}
                  <div className="grid grid-cols-3 gap-3 pb-3">
                    {generateTimeSlots().map((time) => {
                      const expired = isSlotExpired(selectedDate, time);
                      const bookingAtSlot = bookings.find(
                        (b) => b.date === selectedDate && b.time === time,
                      );
                      const isMine =
                        Boolean(bookingAtSlot && user?.id) &&
                        String(bookingAtSlot.user_id) === String(user.id);
                      const isOther = Boolean(bookingAtSlot && !isMine);
                      const clickable = isSlotBookable(time);

                      const isUnavailable = !isMine && (isOther || expired || !clickable);

                      const baseCard =
                        'w-full rounded-xl border px-2 py-3 text-sm text-center transition-all duration-200 flex flex-col items-center justify-center gap-0.5 font-medium';
                      let slotClass = baseCard;
                      if (isMine) {
                        slotClass +=
                          ' cursor-pointer bg-[#0B3B24] text-white border-[#0B3B24] shadow-md scale-[0.98] hover:brightness-110';
                      } else if (isUnavailable) {
                        slotClass += ' labdot-slot-disabled';
                      } else {
                        slotClass +=
                          ' cursor-pointer bg-white border-gray-200 text-gray-900 hover:border-[#0B3B24]/40 hover:shadow-sm active:scale-[0.98]';
                      }

                      const canAlert = slotAlertsEnabled && isOther && !expired &&
                        isMemberAppBookingAllowed(selectedDate, time) &&
                        !isSlotBlocked(blockedSlots, selectedDate, time);
                      if (canAlert || (slotAlertsEnabled && !isMine && slotAlerts[time])) {
                        return <SlotAlertCard key={time} time={time}
                          registered={Boolean(slotAlerts[time])}
                          busy={slotAlertBusy !== null || slotAlertReadError}
                          onClick={() => handleSlotAlert(time)} />;
                      }

                      const slotButtonDisabled = isOther || (!isMine && !clickable);

                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={slotButtonDisabled}
                          onClick={() => {
                            if (isMine && bookingAtSlot) {
                              setCancelIntent(bookingAtSlot);
                              return;
                            }
                            handleBookSlot(time);
                          }}
                          className={slotClass}
                          aria-label={
                            isMine
                              ? `${time} 내 예약 — 탭하여 상세`
                              : isOther
                                ? `${time} 다른 회원 예약`
                                : `${time} ${clickable ? '예약 가능' : '예약 불가'}`
                          }
                        >
                          {isMine ? (
                            <>
                              <span
                                className={`tabular-nums ${expired ? 'line-through opacity-90' : 'font-medium'}`}
                              >
                                {time}
                              </span>
                              {(refined || !isNewMemberUiEnabled()) && (
                                <span className="text-[10px] font-semibold tracking-[0.12em] text-white/95">
                                  {refined ? '내 예약 · 취소' : '내 예약'}
                                </span>
                              )}
                            </>
                          ) : isOther ? (
                            <span className="tabular-nums">{time}</span>
                          ) : (
                            <span className="tabular-nums">{time}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  </>
                )}
              </>
            )}
            {!selectedDate && (
              <p className="text-center text-sm font-light text-gray-400 py-16 tracking-wide">날짜를 선택해 주세요.</p>
            )}

          </div>
        </div>
      )}

      <MemberCancelBookingModals
        refined={refined}
        user={user}
        memberDisplayName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
        openBooking={cancelIntent}
        onOpenBookingChange={setCancelIntent}
        onAfterSuccessConfirm={syncAfterBookingChange}
      />

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
