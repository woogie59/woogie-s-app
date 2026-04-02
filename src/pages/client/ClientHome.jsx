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
  Archive,
  User,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import LabDotBrand from '../../components/ui/LabDotBrand';
import Skeleton from '../../components/ui/Skeleton';
import SessionHistoryModal from '../../features/members/SessionHistoryModal';

const ICON_STROKE = 1.5;

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

const formatUpcomingKorean = (b) => {
  const dt = bookingDateTime(b);
  if (!dt) return '—';
  const wk = ['일', '월', '화', '수', '목', '금', '토'];
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${wk[dt.getDay()]})`;
};

const ClientHome = ({ user, logout, setView }) => {
  const { showAlert } = useGlobalModal();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showAlert]);

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

  const upcomingBooking = useMemo(() => {
    if (!myBookings?.length) return null;
    const now = new Date();
    const future = myBookings
      .map((b) => ({ b, dt: bookingDateTime(b) }))
      .filter((x) => x.dt && x.dt >= now)
      .sort((a, b) => a.dt - b.dt);
    return future[0]?.b ?? null;
  }, [myBookings]);

  const handleCancelBooking = (bookingId, date, time) => {
    setBookingToDelete({ id: bookingId, date, time });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (!bookingToDelete) return;
    setCancelling(bookingToDelete.id);
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingToDelete.id);

    if (error) {
      showAlert({ message: '취소 실패: ' + error.message });
    } else {
      setIsDeleteModalOpen(false);
      setBookingToDelete(null);
      setCancelling(null);
      fetchMyBookings();
      showAlert({ message: '취소가 완료되었습니다.', confirmLabel: '확인' });
    }
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
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const bentoItems = [
    {
      icon: Calendar,
      title: '수업 예약',
      subtitle: 'Class Booking',
      onClick: () => setView('class_booking'),
    },
    {
      icon: Clock,
      title: '내 일정',
      subtitle: 'My Schedule',
      onClick: handleOpenSchedule,
    },
    {
      icon: Archive,
      title: '라이브러리',
      subtitle: 'Library',
      onClick: () => setView('library'),
    },
    {
      icon: User,
      title: '내 정보',
      subtitle: 'Profile',
      onClick: () => setShowProfileModal(true),
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#f8f9fa] text-slate-900 flex flex-col relative pb-safe font-sans">
      <header className="px-5 pt-5 pb-3 flex justify-between items-start gap-3 shrink-0">
        <div className="min-w-0">
          <LabDotBrand variant="header" />
          {loading ? (
            <div className="flex items-center gap-3 mt-2">
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
              <Skeleton className="h-4 w-28" />
            </div>
          ) : (
            <p className="text-gray-400 text-xs mt-2 tracking-wide">
              <span className="text-slate-800 font-medium">{profile?.name || '회원'}</span>
              <span className="text-gray-400"> 님</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {profile?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setView('admin_home')}
              className="text-[10px] tracking-[0.15em] uppercase text-gray-400 hover:text-[#064e3b] px-2 py-1.5 transition-colors"
            >
              Admin
            </button>
          )}
          <button type="button" onClick={logout} className="p-2 rounded-xl text-gray-500 hover:text-slate-900 hover:bg-white/80 transition-colors" aria-label="로그아웃">
            <LogOut size={20} strokeWidth={ICON_STROKE} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-5 gap-4 pb-6 overflow-y-auto scrollable min-h-0">
        {/* Ticket — 다음 수업 */}
        <section className="rounded-2xl bg-[#064e3b] p-5 text-white shadow-[0_12px_40px_-12px_rgba(6,78,59,0.45)] ring-1 ring-white/10">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="text-[10px] tracking-[0.22em] uppercase text-emerald-200/75 font-medium">Upcoming Class</p>
              <h2 className="text-lg font-semibold tracking-tight mt-1.5 text-white">다음 수업</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 text-emerald-100/90 text-xs font-medium hover:text-white transition-colors shrink-0"
            >
              <History size={14} strokeWidth={ICON_STROKE} />
              이력
            </button>
          </div>

          <div className="mt-5 min-h-[4.5rem]">
            {loadingBookings && !myBookings.length ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-48 bg-white/10" />
                <Skeleton className="h-4 w-32 bg-white/10" />
              </div>
            ) : upcomingBooking ? (
              <>
                <p className="text-xl font-semibold tracking-tight leading-snug">{formatUpcomingKorean(upcomingBooking)}</p>
                <p className="text-sm text-emerald-100/85 mt-2 font-medium tabular-nums">
                  {formatTime24h(upcomingBooking.time)}
                </p>
              </>
            ) : (
              <p className="text-sm text-emerald-100/80 leading-relaxed">
                예약된 수업이 없습니다.
                <span className="block text-xs text-emerald-200/60 mt-1.5 font-normal">새 일정은 수업 예약에서 잡을 수 있어요.</span>
              </p>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-baseline">
            <span className="text-xs text-emerald-100/70 tracking-wide">잔여 세션</span>
            {loading ? (
              <Skeleton className="h-6 w-12 bg-white/15 rounded" />
            ) : (
              <span className="text-2xl font-semibold tabular-nums text-white tracking-tight">
                {profile?.remaining_sessions ?? 0}
                <span className="text-sm font-medium text-emerald-100/80 ml-1">회</span>
              </span>
            )}
          </div>
        </section>

        {/* Bento grid */}
        <div className="grid grid-cols-2 gap-3">
          {bentoItems.map(({ icon: Icon, title, subtitle, onClick }) => (
            <button
              key={title}
              type="button"
              onClick={onClick}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-left active:scale-[0.98] transition-transform hover:border-emerald-200/60 hover:shadow-md"
            >
              <Icon className="text-[#064e3b] mb-4" size={26} strokeWidth={ICON_STROKE} />
              <p className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</p>
              <p className="text-[11px] text-gray-400 mt-1.5 tracking-wide">{subtitle}</p>
            </button>
          ))}
        </div>

        {/* Check-in card */}
        <button
          type="button"
          onClick={() => setShowQRModal(true)}
          className="w-full mt-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-5 text-left active:scale-[0.99] transition-all hover:border-emerald-200/50"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#064e3b]/10">
            <QrCode size={32} strokeWidth={ICON_STROKE} className="text-[#064e3b]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-[0.2em] uppercase text-gray-400 font-medium">Check-in</p>
            <p className="text-lg font-semibold text-slate-900 mt-0.5 tracking-tight">체크인</p>
            <p className="text-xs text-gray-400 mt-1">출석 시 스캐너에 QR을 보여주세요.</p>
          </div>
        </button>
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

      {/* Profile modal — 내 정보 */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm"
            onClick={() => setShowProfileModal(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400">Profile</p>
                  <h3 className="text-lg font-semibold text-slate-900 mt-1">내 정보</h3>
                </div>
                <button type="button" onClick={() => setShowProfileModal(false)} className="p-2 text-gray-500 hover:text-slate-900" aria-label="닫기">
                  <X size={22} strokeWidth={ICON_STROKE} />
                </button>
              </div>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                  <span className="text-gray-400">이름</span>
                  <span className="text-slate-900 font-medium text-right">{profile?.name || '—'}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                  <span className="text-gray-400">이메일</span>
                  <span className="text-slate-900 text-right break-all">{profile?.email || user?.email || '—'}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                  <span className="text-gray-400">잔여 세션</span>
                  <span className="text-slate-900 font-semibold tabular-nums">{profile?.remaining_sessions ?? 0}회</span>
                </div>
                {profile?.goal ? (
                  <div className="pt-1">
                    <span className="text-gray-400 block mb-1">목표</span>
                    <p className="text-slate-800 leading-relaxed">{profile.goal}</p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="w-full mt-8 bg-[#064e3b] text-white font-semibold py-3.5 rounded-xl hover:bg-[#053d2f] transition-colors"
              >
                확인
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
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
                            {dayName} {dateStr}
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
