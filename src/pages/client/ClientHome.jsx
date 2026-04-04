import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { sendDirectPush, fetchAdminOnesignalPlayerId } from '../../utils/notifications';
import { deriveSessionFocus, formatKoreanDateFromYmd } from '../../features/training/trainingLogUtils';
import { useGlobalModal } from '../../context/GlobalModalContext';
import LabDotBrand from '../../components/ui/LabDotBrand';
import Skeleton from '../../components/ui/Skeleton';
import SessionHistoryModal from '../../features/members/SessionHistoryModal';

/** Lucide: ~1px hairline for premium UI */
const ICON_STROKE = 1;
/** Bento nav: slightly bolder stroke for clarity */
const BENTO_ICON_STROKE = 1.5;

/** Gateway teaser when no archive row yet */
const DEMO_TRAINING_TEASER = '최근 기록: 4월 3일 - 상체 세션';

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

const bookingDateTime = (b) => {
  if (!b?.date) return null;
  const parts = String(b.date).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const tm = b.time || '09:00';
  const mm = String(tm).match(/(\d{1,2}):(\d{2})/);
  const hh = mm ? parseInt(mm[1], 10) : 9;
  const min = mm ? parseInt(mm[2], 10) : 0;
  return new Date(y, m - 1, d, hh, min);
};

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
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  /** Oldest active pack (FIFO) for 잔여 n/m display */
  const [activePack, setActivePack] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  /** Most recent training log row (gateway teaser) */
  const [latestReport, setLatestReport] = useState(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

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

  const fetchActivePack = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('session_batches')
      .select('remaining_count, total_count')
      .eq('user_id', user.id)
      .gt('remaining_count', 0)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[ClientHome] session_batches:', error);
      setActivePack(null);
      return;
    }
    setActivePack(data || null);
  }, [user]);

  useEffect(() => {
    fetchActivePack();
  }, [fetchActivePack]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_logs',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          showAlert({ message: '✅ 출석완료되었습니다' });
          const fetchProfile = async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();

            if (!error && data) {
              setProfile(data);
            }
          };
          fetchProfile();
          fetchActivePack();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showAlert, fetchActivePack]);

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
          fetchMyBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchMyBookings]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('client_session_reports')
        .select('id, report_date, session_focus, workout_lines, coach_comment')
        .eq('user_id', user.id)
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn('[ClientHome] client_session_reports:', error);
        setLatestReport(null);
        return;
      }
      setLatestReport(data || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const trainingLogTeaser = useMemo(() => {
    if (latestReport?.report_date) {
      const md = formatKoreanDateFromYmd(latestReport.report_date);
      const focus = deriveSessionFocus(latestReport);
      return `최근 기록: ${md} - ${focus}`;
    }
    return DEMO_TRAINING_TEASER;
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

  const sessionRemainLabel = useMemo(() => {
    if (
      activePack &&
      Number.isFinite(Number(activePack.remaining_count)) &&
      Number.isFinite(Number(activePack.total_count))
    ) {
      return `잔여 ${activePack.remaining_count} / ${activePack.total_count}회`;
    }
    const r = profile?.remaining_sessions ?? 0;
    return `잔여 ${r}회`;
  }, [activePack, profile?.remaining_sessions]);

  const handleCancelBooking = (bookingId, date, time) => {
    setBookingToDelete({ id: bookingId, date, time });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (!bookingToDelete) return;
    const { id: bookingId, date, time } = bookingToDelete;
    setCancelling(bookingId);
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);

    if (error) {
      showAlert({ message: '취소 실패: ' + error.message });
      setCancelling(null);
      return;
    }

    try {
      const pid = await fetchAdminOnesignalPlayerId();
      if (pid) {
        const memberName =
          profile?.name?.trim() ||
          user?.user_metadata?.full_name ||
          user?.email?.split('@')[0] ||
          '회원';
        await sendDirectPush(
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
    fetchMyBookings();
    showAlert({ message: '취소가 완료되었습니다.', confirmLabel: '확인' });
  };

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

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-slate-900 flex flex-col relative pb-safe font-sans antialiased">
      <header className="px-5 pt-5 pb-3 flex justify-between items-start gap-3 shrink-0">
        <div className="min-w-0">
          <LabDotBrand variant="header" />
          {loading ? (
            <div className="flex items-center gap-3 mt-2">
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
              <Skeleton className="h-4 w-28" />
            </div>
          ) : (
            <p className="text-gray-500 text-xs mt-2.5 font-light tracking-[0.12em]">
              <span className="text-slate-800">{profile?.name || '회원'}</span>
              <span className="text-gray-400"> 님</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setView('library')}
            className="p-2 rounded-xl text-gray-500 hover:text-[#064e3b] hover:bg-white transition-colors"
            aria-label="인사이트 · 라이브러리"
            title="인사이트"
          >
            <BookOpen size={20} strokeWidth={ICON_STROKE} />
          </button>
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
              {loading ? (
                <Skeleton className="h-5 w-20 bg-white/15 rounded ml-auto sm:ml-0" />
              ) : (
                <p className="text-[12px] sm:text-[11px] font-light tabular-nums tracking-wide text-emerald-50/95 text-right w-full sm:text-right">
                  {sessionRemainLabel}
                </p>
              )}
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
          {/* Training log gateway — archive entry */}
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
                <p className="text-xs text-gray-400 font-light tracking-wide leading-relaxed line-clamp-2">{trainingLogTeaser}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0 text-[#064e3b]/85 pt-0.5">
                <span className="text-[10px] tracking-[0.12em] uppercase font-medium">전체 보기</span>
                <ChevronRight size={20} strokeWidth={BENTO_ICON_STROKE} aria-hidden />
              </div>
            </div>
          </button>
        </div>
      </main>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/30 backdrop-blur-sm"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white border border-gray-100 rounded-2xl p-8 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-[#064e3b] tracking-tight">체크인 QR</h3>
                <button
                  type="button"
                  onClick={() => setShowQRModal(false)}
                  className="text-gray-500 hover:text-slate-900 transition-colors p-1"
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
                  <span className="text-2xl font-semibold text-[#064e3b] tabular-nums">{profile?.remaining_sessions ?? 0}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="w-full mt-6 bg-[#064e3b] text-white font-semibold py-3.5 rounded-xl hover:bg-[#053d2f] active:scale-[0.99] transition-all"
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
                                  onClick={() => handleCancelBooking(booking.id, booking.date, booking.time)}
                                  disabled={cancelling === booking.id}
                                  className="p-2 rounded-lg bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
                                  title="예약 취소"
                                >
                                  <Trash2 size={18} strokeWidth={ICON_STROKE} />
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
