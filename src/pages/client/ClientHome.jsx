import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  History,
  Calendar,
  Clock,
  BookOpen,
  Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { invokeNotifyAdminEvents, fetchAdminOnesignalPlayerId } from '../../utils/notifications';
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
import {
  isMemberAppCancellationAllowed,
  MEMBER_CANCEL_COACH_CONTACT_MESSAGE,
  MEMBER_CANCEL_LOCK_TOOLTIP,
  parseBookingToLocalDate,
} from '../../utils/bookingDateKeys';

/** MVP: 라이브러리·트레이닝 일지 진입 UI 비표시 — 라우트/화면은 유지 */
const MVP_HIDE_LIBRARY_AND_TRAINING_NAV = true;

/** Admin RPC 출석 INSERT와 동일한 Realtime 채널 (필터 user_id=eq.<uuid>와 함께 사용). */
const memberAttendanceChannelName = (userId) => `qr-check-in-channel:${String(userId)}`;

/** Lucide: ~1px hairline for premium UI */
const ICON_STROKE = 1;
/** Bento nav: slightly bolder stroke for clarity */
const BENTO_ICON_STROKE = 1.5;

const toDateKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const getWeekDates = (weekStart) => {
  const arr = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(weekStart);
    dd.setDate(weekStart.getDate() + i);
    arr.push({ date: dd, key: toDateKey(dd) });
  }
  return arr;
};

const bookingDateTime = parseBookingToLocalDate;

const formatTime24hStatic = (t) => {
  if (!t || typeof t !== 'string') return '—';
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
};

/** Schedule modal: "3월 30일" / "4월 3일 (금)" — matches date-fns `M월 d일`, `M월 d일 (EEE)` with ko locale */
const KO_WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

const formatKoreanMonthDay = (date) => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}월 ${d}일`;
};

const formatKoreanDayHeader = (date) => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = KO_WEEKDAYS_SHORT[date.getDay()];
  return `${m}월 ${d}일 (${w})`;
};

const formatUpcomingLine = (b) => {
  const dt = bookingDateTime(b);
  if (!dt) return '—';
  const tm = formatTime24hStatic(b?.time);
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${KO_WEEKDAYS_SHORT[dt.getDay()]}) ${tm}`;
};

const ClientHome = ({ user, logout, setView }) => {
  const { showAlert } = useGlobalModal();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  /** Fade-out QR modal over 0.5s after 출석 감지 (attendance_logs INSERT 또는 bookings UPDATE) */
  const [qrCheckInClosing, setQrCheckInClosing] = useState(false);
  const qrCloseTimerRef = useRef(null);
  /** attendance_logs INSERT + bookings UPDATE 둘 다 올 때 토스트/팝업 중복 방지 */
  const lastCheckInRealtimeRef = useRef(0);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  /** All packs for this user — sum(total_count) = purchased sessions (source of truth for 잔여). */
  const [sessionBatches, setSessionBatches] = useState([]);
  /** attendance_logs rows for eligible count (with bookings, excludes zombies). */
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [cancelling, setCancelling] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  /** 수업 2시간 이내 취소 시도 — ClassBooking「다음 주」잠금과 동일 톤의 안내 */
  const [showCancelPolicyLockModal, setShowCancelPolicyLockModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  /** Most recent training log row (`client_session_reports`) for gateway teaser */
  const [latestReport, setLatestReport] = useState(null);
  const [latestReportLoading, setLatestReportLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  useEffect(() => {
    return () => {
      if (qrCloseTimerRef.current != null) {
        clearTimeout(qrCloseTimerRef.current);
        qrCloseTimerRef.current = null;
      }
    };
  }, []);

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
            if (qrCloseTimerRef.current != null) {
              clearTimeout(qrCloseTimerRef.current);
              qrCloseTimerRef.current = null;
            }
            setQrCheckInClosing(false);
            setShowQRModal(false);

            const now = Date.now();
            if (now - lastCheckInRealtimeRef.current < 2000) return;
            lastCheckInRealtimeRef.current = now;

            alert('출석이 완료되었습니다!');
            window.location.reload();
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

  const sessionMetrics = useMemo(() => {
    const batches = Array.isArray(sessionBatches) ? sessionBatches : [];
    const logs = Array.isArray(attendanceLogs) ? attendanceLogs : [];
    const totalPurchased = sumTotalPurchasedFromBatches(batches);
    const usedSessionCount = countCompletedAttendanceLogs(logs);
    const remaining = computeRemainingSessions(totalPurchased, usedSessionCount);
    return { totalPurchased, usedSessionCount, remaining };
  }, [sessionBatches, attendanceLogs]);

  const sessionRemainLabel = useMemo(() => {
    const { totalPurchased, remaining } = sessionMetrics;
    if (totalPurchased > 0) {
      return `잔여 ${remaining} / ${totalPurchased}회`;
    }
    return `잔여 ${remaining}회`;
  }, [sessionMetrics]);

  const handleCancelBooking = (booking) => {
    if (!isMemberAppCancellationAllowed(booking)) {
      setShowCancelPolicyLockModal(true);
      return;
    }
    setBookingToDelete({ id: booking.id, date: booking.date, time: booking.time });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (!bookingToDelete) return;
    const { id: bookingId, date, time } = bookingToDelete;
    if (!isMemberAppCancellationAllowed({ id: bookingId, date, time })) {
      setIsDeleteModalOpen(false);
      setBookingToDelete(null);
      setShowCancelPolicyLockModal(true);
      return;
    }
    setCancelling(bookingId);
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);

    if (error) {
      showAlert({ message: '취소 실패: ' + error.message });
      setCancelling(null);
      return;
    }

    setMyBookings((prev) => prev.filter((b) => b.id !== bookingId));
    setShowQRModal(false);
    setQrCheckInClosing(false);
    if (qrCloseTimerRef.current != null) {
      clearTimeout(qrCloseTimerRef.current);
      qrCloseTimerRef.current = null;
    }

    try {
      const pid = await fetchAdminOnesignalPlayerId();
      if (pid) {
        const memberName =
          profile?.name?.trim() ||
          user?.user_metadata?.full_name ||
          user?.email?.split('@')[0] ||
          '회원';
        await invokeNotifyAdminEvents(
          pid,
          '세션 취소 알림',
          `${memberName}님 - ${date} ${time} 예약이 취소되었습니다.`
        );
      }
    } catch (e) {
      console.warn('[ClientHome] cancel push:', e);
    }

    setIsDeleteModalOpen(false);
    setBookingToDelete(null);
    setCancelling(null);
    await fetchMyBookings();
    await loadSessionMetrics();
    emitSessionBalanceRefresh();
    showAlert({ message: '취소가 완료되었습니다.', confirmLabel: '확인' });
  };

  /** 내 일정 모달 열림: 2시간 락 경계·버튼 활성이 시간에 맞게 갱신되도록 */
  const [memberCancelUiTick, setMemberCancelUiTick] = useState(0);
  useEffect(() => {
    if (!showScheduleModal) return undefined;
    const id = window.setInterval(() => setMemberCancelUiTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [showScheduleModal]);

  useEffect(() => {
    if (!showScheduleModal) setShowCancelPolicyLockModal(false);
  }, [showScheduleModal]);

  const handleOpenSchedule = () => {
    setShowScheduleModal(true);
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
    fetchMyBookings();
  };

  const todayKey = toDateKey(new Date());

  const bookingsInWeek = useMemo(() => {
    const week = getWeekDates(currentWeekStart);
    const start = week[0].key;
    const end = week[6].key;
    return (myBookings || []).filter((b) => b.date >= start && b.date <= end);
  }, [myBookings, currentWeekStart]);

  const bookingsByDay = useMemo(() => {
    const map = {};
    bookingsInWeek.forEach((b) => {
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    );
    return map;
  }, [bookingsInWeek]);

  const formatTime24h = (t) => {
    if (!t || typeof t !== 'string') return t || '—';
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
  };

  const weekLabel = () => {
    const start = getWeekDates(currentWeekStart)[0].date;
    const end = getWeekDates(currentWeekStart)[6].date;
    return `${formatKoreanMonthDay(start)} - ${formatKoreanMonthDay(end)}`;
  };

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
        {/* 1. Upcoming Class — read-only billboard; 일정은 벤토「내 일정」에서만 열림 */}
        <div className="w-full rounded-xl bg-[#064e3b] px-3 py-3 text-left text-white shadow-md ring-1 ring-white/10 shrink-0 sm:px-4 sm:py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 sm:justify-between">
            <div className="flex items-start gap-2 sm:max-w-[32%] min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-medium">Upcoming Class</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHistory(true);
                    }}
                    className="p-1 rounded-md text-emerald-200/90 hover:bg-white/10 hover:text-white transition-all duration-200 ease-in-out shrink-0 cursor-pointer active:scale-95"
                    aria-label="출석 이력"
                  >
                    <History size={15} strokeWidth={ICON_STROKE} />
                  </button>
                  <span className="text-[13px] font-light tracking-wide text-white/95 leading-tight">다음 수업</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 sm:text-center px-1">
              {loadingBookings && !myBookings.length ? (
                <Skeleton className="h-5 w-full max-w-[220px] mx-auto sm:mx-auto bg-white/10 rounded" />
              ) : upcomingBooking ? (
                <p className="text-[13px] sm:text-sm font-light tracking-wide tabular-nums text-white leading-snug">
                  {formatUpcomingLine(upcomingBooking)}
                </p>
              ) : (
                <p className="text-[12px] font-light tracking-wide text-emerald-100/85">예약 없음 · 수업 예약에서 일정을 잡아보세요.</p>
              )}
            </div>

            <div className="flex sm:justify-end sm:max-w-[32%] sm:min-w-[7rem] shrink-0 border-t border-white/10 pt-2 sm:border-t-0 sm:pt-0">
              <p className="text-[12px] sm:text-[11px] font-light tabular-nums tracking-wide text-emerald-50/95 text-right w-full sm:text-right">
                {sessionRemainLabel}
              </p>
            </div>
          </div>
        </div>

        {/* 2. 출석하기 — icon + label only, centered */}
        <button
          type="button"
          onClick={() => setShowQRModal(true)}
          className="w-full shrink-0 flex flex-col items-center justify-center gap-3 cursor-pointer rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-8 transition-all duration-200 ease-in-out hover:bg-gray-50 active:scale-[0.98] active:bg-gray-50"
        >
          <QrCode size={30} strokeWidth={ICON_STROKE} className="text-[#064e3b]" aria-hidden />
          <span className="text-[15px] font-light tracking-wide text-slate-900">출석하기</span>
        </button>

        {/* 3. Navigation — 2+1 asymmetrical bento */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setView('class_booking')}
              className="aspect-square bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-start justify-between text-left transition-all duration-200 active:scale-[0.98] active:bg-gray-50 hover:bg-gray-50/80 cursor-pointer"
            >
              <Calendar size={26} strokeWidth={BENTO_ICON_STROKE} className="text-[#064e3b] shrink-0" aria-hidden />
              <span className="text-[15px] font-light tracking-wide text-slate-900 leading-tight">수업 예약</span>
            </button>
            <button
              type="button"
              onClick={handleOpenSchedule}
              className="aspect-square bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-start justify-between text-left transition-all duration-200 active:scale-[0.98] active:bg-gray-50 hover:bg-gray-50/80 cursor-pointer"
            >
              <Clock size={26} strokeWidth={BENTO_ICON_STROKE} className="text-[#064e3b] shrink-0" aria-hidden />
              <span className="text-[15px] font-light tracking-wide text-slate-900 leading-tight">내 일정</span>
            </button>
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

      {/* QR Code Modal — realtime 출석 감지 시 0.5s fade-out → 출석 완료 알림 */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: qrCheckInClosing ? 0 : 1 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/30 backdrop-blur-sm"
            onClick={() => !qrCheckInClosing && setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: qrCheckInClosing ? 0.98 : 1, opacity: qrCheckInClosing ? 0 : 1 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white border border-gray-100 rounded-2xl p-8 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-[#064e3b] tracking-tight">체크인 QR</h3>
                <button
                  type="button"
                  onClick={() => !qrCheckInClosing && setShowQRModal(false)}
                  disabled={qrCheckInClosing}
                  className="text-gray-500 hover:text-slate-900 transition-colors p-1 disabled:opacity-40"
                  aria-label="닫기"
                >
                  <X size={22} strokeWidth={ICON_STROKE} />
                </button>
              </div>

              <div className="flex flex-col items-center mb-6">
                <p className="text-[10px] text-gray-400 tracking-[0.25em] uppercase font-medium mb-3">Membership Pass</p>
                <div className="bg-[#fafafa] border border-gray-100 rounded-2xl p-8 flex items-center justify-center w-full max-w-[280px]">
                  {user?.id ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(user.id)}&size=200x200&format=png&color=18181b&bgcolor=fafafa`}
                      alt="Check-in QR Code"
                      className="rounded-lg"
                    />
                  ) : (
                    <div className="w-[200px] h-[200px] bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                      <span className="text-gray-500 text-sm">로딩 중…</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500 text-sm">이름</span>
                  <span className="text-slate-900 font-semibold">{profile?.name || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">잔여 세션</span>
                  <span className="text-2xl font-semibold text-[#064e3b] tabular-nums">{sessionMetrics.remaining}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !qrCheckInClosing && setShowQRModal(false)}
                disabled={qrCheckInClosing}
                className="w-full mt-6 bg-[#064e3b] text-white font-semibold py-3.5 rounded-xl hover:bg-[#053d2f] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My Schedule Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/30 backdrop-blur-sm"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white border border-gray-100 rounded-2xl p-6 max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              data-lock-tick={memberCancelUiTick}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400">Schedule</p>
                  <h3 className="text-lg font-semibold text-[#064e3b] mt-0.5">내 일정</h3>
                </div>
                <button type="button" onClick={() => setShowScheduleModal(false)} className="text-gray-500 hover:text-slate-900 p-1" aria-label="닫기">
                  <X size={22} strokeWidth={ICON_STROKE} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    const prev = new Date(currentWeekStart);
                    prev.setDate(prev.getDate() - 7);
                    setCurrentWeekStart(prev);
                  }}
                  className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-[#064e3b] transition"
                >
                  <ChevronLeft size={22} strokeWidth={ICON_STROKE} />
                </button>
                <span className="text-sm font-semibold text-slate-900 min-w-[180px] text-center">{weekLabel()}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(currentWeekStart);
                    next.setDate(next.getDate() + 7);
                    setCurrentWeekStart(next);
                  }}
                  className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-[#064e3b] transition"
                >
                  <ChevronRight size={22} strokeWidth={ICON_STROKE} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 min-h-0 scrollable">
                {loadingBookings ? (
                  <p className="text-gray-500 text-center py-10 text-sm">불러오는 중…</p>
                ) : (
                  getWeekDates(currentWeekStart).map(({ date, key }) => {
                    const dayBookings = bookingsByDay[key] || [];
                    const isToday = key === todayKey;
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border overflow-hidden ${
                          isToday ? 'bg-emerald-50/80 border-emerald-200' : 'bg-gray-50/80 border-gray-100'
                        }`}
                      >
                        <div
                          className={`px-4 py-2 flex items-center justify-between ${
                            isToday ? 'bg-emerald-100/50' : 'bg-white/50'
                          }`}
                        >
                          <span className="font-semibold text-slate-900 text-sm">
                            {formatKoreanDayHeader(date)}
                          </span>
                          {isToday && (
                            <span className="text-[10px] font-semibold text-white bg-[#064e3b] px-2 py-0.5 rounded-md tracking-wide">
                              오늘
                            </span>
                          )}
                        </div>
                        {dayBookings.length === 0 ? (
                          <div className="px-4 py-3 text-gray-500 text-sm">휴식</div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {dayBookings.map((booking) => (
                              <div key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="flex-1">
                                  <span className="text-xl font-mono font-semibold text-[#064e3b] tabular-nums">
                                    {formatTime24h(booking.time)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCancelBooking(booking)}
                                  disabled={cancelling === booking.id}
                                  className={`p-2 rounded-xl text-xs font-light tracking-wide transition-all duration-200 active:scale-[0.98] ${
                                    cancelling === booking.id
                                      ? 'opacity-50 border border-gray-100 bg-gray-50 text-gray-400'
                                      : isMemberAppCancellationAllowed(booking)
                                        ? 'bg-red-50 border border-red-100 text-red-600 hover:bg-red-100'
                                        : 'bg-gray-100 border border-gray-100/90 text-gray-400 shadow-sm'
                                  }`}
                                  title={
                                    isMemberAppCancellationAllowed(booking) ? '예약 취소' : MEMBER_CANCEL_LOCK_TOOLTIP
                                  }
                                >
                                  <Trash2 size={18} strokeWidth={ICON_STROKE} className="mx-auto" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {bookingsInWeek.length === 0 && !loadingBookings && (
                <p className="text-gray-500 text-xs text-center mt-2">이번 주 예약이 없어요. 수업 예약에서 일정을 잡아보세요.</p>
              )}

              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="w-full mt-4 bg-[#064e3b] text-white font-semibold py-3.5 rounded-xl hover:bg-[#053d2f] active:scale-[0.99] transition-all"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2시간 이내 취소 불가 — 수업 예약「다음 주」잠금과 동일한 임상적 톤 */}
      <AnimatePresence>
        {showCancelPolicyLockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-gray-900/30 backdrop-blur-sm"
            onClick={() => setShowCancelPolicyLockModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-sm w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-6">
                <Lock size={40} strokeWidth={ICON_STROKE} className="text-gray-300" aria-hidden />
              </div>
              <p className="text-sm font-light text-slate-800 leading-relaxed tracking-wide">{MEMBER_CANCEL_COACH_CONTACT_MESSAGE}</p>
              <button
                type="button"
                onClick={() => setShowCancelPolicyLockModal(false)}
                className="w-full mt-8 py-3 rounded-xl text-sm font-light tracking-wide bg-[#064e3b] text-white shadow-sm hover:bg-[#053d2f] active:scale-[0.98] transition-all duration-200"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session History Modal */}
      <AnimatePresence>
        {showHistory && (
          <SessionHistoryModal user={user} onClose={() => setShowHistory(false)} />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && bookingToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-white border border-gray-100 rounded-2xl shadow-xl p-6 max-w-sm w-full"
            >
              <h3 className="text-lg font-semibold text-[#064e3b] mb-2">예약 취소</h3>
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {bookingToDelete.date} {bookingToDelete.time} 수업 예약을 취소할까요?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setBookingToDelete(null);
                  }}
                  className="px-5 py-3 rounded-xl text-gray-600 hover:text-slate-900 hover:bg-gray-50 transition-all font-medium min-w-[80px]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAction}
                  disabled={cancelling === bookingToDelete.id}
                  className="px-5 py-3 rounded-xl bg-[#064e3b] text-white font-semibold hover:bg-[#053d2f] transition-all disabled:opacity-50 min-w-[80px]"
                >
                  {cancelling === bookingToDelete.id ? '처리 중…' : '예, 취소할게요'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientHome;
