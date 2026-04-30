import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, LogOut, ChevronRight, Calendar, BookOpen, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { deriveSessionFocus, formatKoreanDateFromYmd } from '../../features/training/trainingLogUtils';
import {
  computeRemainingSessions,
  countCompletedAttendanceLogs,
  fetchSessionBalanceMetrics,
  sumTotalPurchasedFromBatches,
} from '../../utils/sessionHelpers';
import { emitSessionBalanceRefresh } from '../../utils/sessionBalanceEvents';
import { useGlobalModal } from '../../context/GlobalModalContext';
import LabDotBrand from '../../components/ui/LabDotBrand';
import Skeleton from '../../components/ui/Skeleton';
import SessionHistoryModal from '../../features/members/SessionHistoryModal';
import { parseBookingToLocalDate } from '../../utils/bookingDateKeys';

/** MVP: 라이브러리·트레이닝 일지 진입 UI 비표시 — 라우트/화면은 유지 */
const MVP_HIDE_LIBRARY_AND_TRAINING_NAV = true;
/** Admin RPC 출석 INSERT와 동일한 Realtime 채널 (필터 user_id=eq.<uuid>와 함께 사용). */
const memberAttendanceChannelName = (userId) => `qr-check-in-channel:${String(userId)}`;

/** Lucide: ~1px hairline for premium UI */
const ICON_STROKE = 1;
/** Bento nav: slightly bolder stroke for clarity */
const BENTO_ICON_STROKE = 1.5;

const bookingDateTime = parseBookingToLocalDate;

const formatTime24hStatic = (t) => {
  if (!t || typeof t !== 'string') return '—';
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
};

const KO_WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

const formatUpcomingDateLabel = (b) => {
  const dt = bookingDateTime(b);
  if (!dt) return '—';
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${KO_WEEKDAYS_SHORT[dt.getDay()]})`;
};

const ClientHome = ({ user, logout, setView }) => {
  const { showAlert } = useGlobalModal();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCheckInSubmitting, setIsCheckInSubmitting] = useState(false);
  /** attendance_logs INSERT + bookings UPDATE 둘 다 올 때 토스트/팝업 중복 방지 */
  const lastCheckInRealtimeRef = useRef(0);

  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  /** All packs for this user — sum(total_count) = purchased sessions (source of truth for 잔여). */
  const [sessionBatches, setSessionBatches] = useState([]);
  /** attendance_logs rows for eligible count (with bookings, excludes zombies). */
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  /** Most recent training log row (`client_session_reports`) for gateway teaser */
  const [latestReport, setLatestReport] = useState(null);
  const [latestReportLoading, setLatestReportLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('프로필 로딩 실패:', error);
      } else {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const loadSessionMetrics = useCallback(async () => {
    if (!user?.id) return;
    const m = await fetchSessionBalanceMetrics(supabase, user.id);
    setSessionBatches(Array.isArray(m.batches) ? m.batches : []);
    setAttendanceLogs(Array.isArray(m.logs) ? m.logs : []);
  }, [user]);

  useEffect(() => {
    loadSessionMetrics();
  }, [loadSessionMetrics]);

  const fetchMyBookings = useCallback(async () => {
    if (!user) return;

    setLoadingBookings(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) {
        setMyBookings([]);
      } else {
        setMyBookings(data || []);
      }
    } catch (err) {
      setMyBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyBookings();
  }, [fetchMyBookings]);

  const refreshAfterAttendanceChange = useCallback(async () => {
    if (!user?.id) return null;
    await Promise.all([fetchMyBookings(), loadSessionMetrics()]);
    emitSessionBalanceRefresh();
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!error && data) setProfile(data);
    return fetchSessionBalanceMetrics(supabase, user.id);
  }, [user?.id, fetchMyBookings, loadSessionMetrics]);

  const refreshAfterAttendanceChangeRef = useRef(refreshAfterAttendanceChange);
  useEffect(() => {
    refreshAfterAttendanceChangeRef.current = refreshAfterAttendanceChange;
  }, [refreshAfterAttendanceChange]);

  /**
   * 출석 INSERT/변경: 단일 채널 · 모달 열림 여부와 무관하게 항상 구독.
   * 카메라/백그라운드 후 WebSocket 재연결을 위해 visibility 시 재구독.
   */
  useEffect(() => {
    if (!user?.id) return;

    const uid = String(user.id);
    let channel = null;

    const attachAttendanceListener = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      channel = supabase.channel(memberAttendanceChannelName(uid)).on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_logs',
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          console.log('🔥 Change Detected:', payload);

          if (payload.eventType === 'DELETE') {
            void refreshAfterAttendanceChangeRef.current?.();
            return;
          }

          if (payload.eventType === 'INSERT') {
            const now = Date.now();
            if (now - lastCheckInRealtimeRef.current < 2000) return;
            lastCheckInRealtimeRef.current = now;
            void refreshAfterAttendanceChangeRef.current?.();
            return;
          }

          void refreshAfterAttendanceChangeRef.current?.();
        }
      );

      channel.subscribe((status) => {
        console.log('📡 [qr-check-in-channel] attendance_logs:', status);
        if (status === 'SUBSCRIBED') {
          console.log('📡 Realtime Connected');
        }
      });
    };

    attachAttendanceListener();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        attachAttendanceListener();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`bookings_rt_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void (async () => {
            await fetchMyBookings();
            await loadSessionMetrics();
            emitSessionBalanceRefresh();
          })();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchMyBookings, loadSessionMetrics]);

  useEffect(() => {
    if (!user?.id) return;

    const ch = supabase
      .channel(`session_batches_rt_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_batches', filter: `user_id=eq.${user.id}` },
        () => {
          void (async () => {
            await loadSessionMetrics();
            emitSessionBalanceRefresh();
          })();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, loadSessionMetrics]);

  const fetchLatestReport = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('client_session_reports')
      .select('id, report_date, session_focus, workout_lines, coach_comment')
      .eq('user_id', user.id)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[ClientHome] client_session_reports:', error);
      setLatestReport(null);
      return;
    }
    setLatestReport(data ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLatestReportLoading(true);
      await fetchLatestReport();
      if (!cancelled) setLatestReportLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, fetchLatestReport]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`client_session_reports_rt_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_session_reports',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchLatestReport();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchLatestReport]);

  useEffect(() => {
    if (!user?.id) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchLatestReport();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user?.id, fetchLatestReport]);

  const trainingLogTeaser = useMemo(() => {
    if (!latestReport?.report_date) return null;
    const md = formatKoreanDateFromYmd(latestReport.report_date);
    const focus = deriveSessionFocus(latestReport);
    return `최근 기록: ${md} - ${focus}`;
  }, [latestReport]);

  const upcomingBooking = useMemo(() => {
    if (!myBookings?.length) return null;
    const now = new Date();
    const future = myBookings
      .map((b) => ({ b, dt: bookingDateTime(b) }))
      .filter((x) => x.dt && x.dt >= now)
      .sort((a, b) => a.dt - b.dt);
    return future[0]?.b ?? null;
  }, [myBookings]);

  const todayNearestBooking = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayBookings = (myBookings || [])
      .filter((b) => {
        if (!b) return false;
        if (b.status === 'cancelled') return false;
        const d = bookingDateTime(b);
        if (!d) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return key === todayKey;
      })
      .map((b) => ({ booking: b, start: bookingDateTime(b) }))
      .filter((x) => x.start instanceof Date && !Number.isNaN(x.start.getTime()));

    if (!todayBookings.length) return null;

    const candidates = todayBookings
      .filter((x) => (now.getTime() - x.start.getTime()) / 60000 <= 15)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return candidates[0]?.booking ?? null;
  }, [myBookings]);

  const hasCheckedInForNearest = useMemo(() => {
    if (!todayNearestBooking) return false;
    if (todayNearestBooking.status === 'completed' || todayNearestBooking.status === 'attended') return true;
    const targetTime = formatTime24hStatic(todayNearestBooking.time);
    const targetDate = bookingDateTime(todayNearestBooking);
    if (!targetDate) return false;
    return (attendanceLogs || []).some((log) => {
      const d = new Date(log.check_in_at);
      if (Number.isNaN(d.getTime())) return false;
      const sameDate =
        d.getFullYear() === targetDate.getFullYear() &&
        d.getMonth() === targetDate.getMonth() &&
        d.getDate() === targetDate.getDate();
      if (!sameDate) return false;
      const fixed = typeof log.session_time_fixed === 'string' ? formatTime24hStatic(log.session_time_fixed) : null;
      const logTime = fixed || d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
      return formatTime24hStatic(logTime) === targetTime;
    });
  }, [todayNearestBooking, attendanceLogs]);

  const isCheckInWindowOpen = useMemo(() => {
    if (!todayNearestBooking) return false;
    const start = bookingDateTime(todayNearestBooking);
    if (!start) return false;
    const now = new Date();
    const diffMin = (now.getTime() - start.getTime()) / 60000;
    return diffMin >= -30 && diffMin <= 15;
  }, [todayNearestBooking]);

  const checkInButtonState = useMemo(() => {
    if (hasCheckedInForNearest) return 'completed';
    if (isCheckInWindowOpen) return 'active';
    return 'disabled';
  }, [hasCheckedInForNearest, isCheckInWindowOpen]);

  const handleSelfCheckIn = useCallback(async () => {
    if (checkInButtonState !== 'active' || isCheckInSubmitting) return;
    if (!user?.id) return;
    setIsCheckInSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('check_in_user', { user_uuid: user.id });
      if (rpcError) throw rpcError;

      if (todayNearestBooking?.id) {
        const { error: updateErr } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', todayNearestBooking.id);
        if (updateErr) console.warn('[ClientHome] booking complete update:', updateErr);
      }
      await Promise.all([fetchMyBookings(), loadSessionMetrics()]);
      showAlert({ message: '출석이 완료되었습니다.' });
    } catch (e) {
      console.error('[ClientHome] self check-in:', e);
      showAlert({ message: e?.message || '출석 처리에 실패했습니다.' });
    } finally {
      setIsCheckInSubmitting(false);
    }
  }, [checkInButtonState, isCheckInSubmitting, user?.id, todayNearestBooking, fetchMyBookings, loadSessionMetrics, showAlert]);

  const upcomingBookingsPreview = useMemo(() => {
    if (!myBookings?.length) return [];
    const now = new Date();
    return myBookings
      .map((b) => ({ b, dt: bookingDateTime(b) }))
      .filter((x) => x.dt && x.dt >= now)
      .sort((a, b) => a.dt - b.dt)
      .slice(0, 3)
      .map((x) => x.b);
  }, [myBookings]);

  const sessionMetrics = useMemo(() => {
    const batches = Array.isArray(sessionBatches) ? sessionBatches : [];
    const logs = Array.isArray(attendanceLogs) ? attendanceLogs : [];
    const totalPurchased = sumTotalPurchasedFromBatches(batches);
    const usedSessionCount = countCompletedAttendanceLogs(logs);
    const remaining = computeRemainingSessions(totalPurchased, usedSessionCount);
    return { totalPurchased, usedSessionCount, remaining };
  }, [sessionBatches, attendanceLogs]);

  const sessionRemainBadgeLabel = useMemo(() => `잔여 ${sessionMetrics.remaining}회`, [sessionMetrics.remaining]);

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 px-6">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[#064e3b]/25 border-t-[#064e3b]"
          aria-hidden
        />
        <p className="mt-4 text-center text-sm text-gray-500">회원 정보를 불러오는 중입니다…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 px-6">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[#064e3b]/25 border-t-[#064e3b]"
          aria-hidden
        />
        <p className="mt-4 text-center text-sm text-gray-500">대시보드를 준비하는 중입니다…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-slate-900 flex flex-col relative pb-safe font-sans antialiased">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-start gap-2 px-5 pt-5 pb-3">
        <div aria-hidden className="min-w-0" />
        <div className="flex min-w-0 flex-col items-center text-center">
          <LabDotBrand variant="header" />
          <p className="mt-2.5 text-xs font-light tracking-[0.12em] text-gray-500">
            <span className="text-slate-800">{profile?.name || '회원'}</span>
            <span className="text-gray-400"> 님</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-0.5 pt-0.5">
          {!MVP_HIDE_LIBRARY_AND_TRAINING_NAV && (
            <button
              type="button"
              onClick={() => setView('library')}
              className="p-2 rounded-xl text-gray-500 hover:text-[#064e3b] hover:bg-white transition-colors"
              aria-label="인사이트 · 라이브러리"
              title="인사이트"
            >
              <BookOpen size={20} strokeWidth={ICON_STROKE} />
            </button>
          )}
          {profile?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setView('admin_home')}
              className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-light hover:text-[#064e3b] px-2 py-1.5 transition-colors"
            >
              Admin
            </button>
          )}
          <button type="button" onClick={logout} className="p-2 rounded-xl text-gray-500 hover:text-slate-900 hover:bg-white transition-colors" aria-label="로그아웃">
            <LogOut size={20} strokeWidth={ICON_STROKE} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-5 gap-4 pb-6 overflow-y-auto scrollable min-h-0">
        {/* 1. Upcoming Class — read-only billboard; 전체 일정은「수업 예약 및 일정」화면 */}
        <div className="w-full rounded-2xl bg-[#064e3b] px-4 py-4 text-left text-white shadow-md ring-1 ring-white/10 shrink-0 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/70 font-medium mb-1">다음 수업</p>
              {loadingBookings && !myBookings.length ? (
                <Skeleton className="h-14 w-40 bg-white/15 rounded-xl" />
              ) : upcomingBooking ? (
                <>
                  <p className="text-6xl font-extrabold tracking-tighter tabular-nums text-white leading-none">
                    {formatTime24hStatic(upcomingBooking?.time)}
                  </p>
                  <p className="text-base text-white/90 mt-2">{formatUpcomingDateLabel(upcomingBooking)}</p>
                </>
              ) : (
                <p className="text-[13px] font-medium text-white/90 mt-2">예약 없음 · 수업 예약 및 일정에서 잡아보세요.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-semibold text-white flex items-center gap-1 cursor-pointer transition hover:bg-white/30 shrink-0"
              aria-label="멤버십 현황 열기"
            >
              <span className="tabular-nums">{sessionRemainBadgeLabel}</span>
              <span aria-hidden>›</span>
            </button>
          </div>
        </div>

        {/* 2. 출석하기 — self check-in smart button */}
        <button
          type="button"
          onClick={handleSelfCheckIn}
          disabled={checkInButtonState !== 'active' || isCheckInSubmitting}
          className={`w-full my-10 shrink-0 flex flex-col items-center justify-center gap-3 rounded-3xl px-6 py-10 transition-all duration-200 ease-in-out ${
            checkInButtonState === 'completed'
              ? 'bg-gray-900 text-white shadow-lg cursor-not-allowed'
              : checkInButtonState === 'active'
                ? 'bg-[#064e3b] text-white shadow-2xl hover:bg-[#053d2f] active:scale-[0.985] animate-pulse cursor-pointer'
                : 'bg-gray-300 text-white/95 shadow-none opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 px-4 py-3">
            {checkInButtonState === 'completed' ? (
              <Check size={34} strokeWidth={2.2} className="text-white" aria-hidden />
            ) : (
              <QrCode size={34} strokeWidth={1.25} className="text-white" aria-hidden />
            )}
          </div>
          <span className="text-2xl font-bold tracking-tight">
            {checkInButtonState === 'completed' ? '출석 완료' : checkInButtonState === 'active' ? '출석하기 (터치)' : '출석 가능 시간이 아닙니다'}
          </span>
          <span className="text-sm text-white/75 font-medium tracking-wide">
            {isCheckInSubmitting
              ? '처리 중...'
              : checkInButtonState === 'completed'
                ? `오늘도 고생하셨습니다! (남은 수강권: ${sessionMetrics.remaining}회)`
                : checkInButtonState === 'active'
                ? '수업 시작 30분 전부터 시작 후 15분까지 가능합니다'
                : '출석 가능 시간: 수업 시작 30분 전 ~ 시작 후 15분'}
          </span>
        </button>

        {/* 3. Open schedule flow */}
        <div className="flex flex-col gap-5 pb-2">
          <button
            type="button"
            onClick={() => setView('class_booking')}
            className="w-full flex flex-row items-center justify-between text-left gap-4 min-w-0 cursor-pointer transition-colors duration-200 hover:text-[#064e3b]"
          >
            <div className="flex flex-row items-center gap-3 min-w-0 flex-1">
              <Calendar size={24} strokeWidth={BENTO_ICON_STROKE} className="text-[#064e3b] shrink-0" aria-hidden />
              <div className="flex flex-col justify-center min-w-0 text-left">
                <span className="text-xl font-semibold text-slate-900 tracking-tight leading-snug">수업 예약 및 일정</span>
              </div>
            </div>
            <ChevronRight size={22} strokeWidth={BENTO_ICON_STROKE} className="text-gray-400 shrink-0 self-center" aria-hidden />
          </button>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-500">나의 다가오는 일정</p>
            {loadingBookings && !myBookings.length ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="h-4 w-48 rounded" />
              </div>
            ) : upcomingBookingsPreview.length === 0 ? (
              <p className="text-sm text-gray-400">아직 예정된 수업이 없습니다.</p>
            ) : (
              <ul className="space-y-2.5">
                {upcomingBookingsPreview.map((booking) => (
                  <li key={booking.id} className="flex items-center justify-between gap-4 py-1">
                    <span className="text-sm text-slate-800 font-medium">{formatUpcomingDateLabel(booking)}</span>
                    <span className="text-sm tabular-nums text-[#064e3b] font-semibold">{formatTime24hStatic(booking.time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!MVP_HIDE_LIBRARY_AND_TRAINING_NAV && (
            <button
              type="button"
              onClick={() => setView('training_log')}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left transition-all duration-200 active:scale-[0.98] active:bg-gray-50 hover:bg-gray-50/80"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#064e3b] shrink-0" aria-hidden />
                <span className="text-[10px] tracking-[0.22em] uppercase text-gray-500 font-medium">TRAINING LOG</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-medium text-slate-900 tracking-tight mb-1.5">트레이닝 일지</h3>
                  {latestReportLoading ? (
                    <Skeleton className="h-4 w-48 max-w-full rounded" />
                  ) : trainingLogTeaser ? (
                    <p className="text-xs text-gray-400 font-light tracking-wide leading-relaxed line-clamp-2">{trainingLogTeaser}</p>
                  ) : (
                    <p className="text-xs text-gray-400 font-light tracking-wide leading-relaxed">기록이 없습니다</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0 text-[#064e3b]/85 pt-0.5">
                  <span className="text-[10px] tracking-[0.12em] uppercase font-medium">전체 보기</span>
                  <ChevronRight size={20} strokeWidth={BENTO_ICON_STROKE} aria-hidden />
                </div>
              </div>
            </button>
          )}
        </div>
      </main>

      {/* Session History Modal */}
      <AnimatePresence>
        {showHistory && (
          <SessionHistoryModal user={user} onClose={() => setShowHistory(false)} />
        )}
      </AnimatePresence>

    </div>
  );
};

export default ClientHome;
