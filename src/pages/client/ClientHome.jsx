import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, LogOut, X, Sparkles, ChevronLeft, ChevronRight, Trash2, History } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import ButtonGhost from '../../components/ui/ButtonGhost';
import Skeleton from '../../components/ui/Skeleton';
import SessionHistoryModal from '../../features/members/SessionHistoryModal';

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

const ClientHome = ({ user, logout, setView }) => {
  const { showAlert } = useGlobalModal();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
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

  const fetchMyBookings = async () => {
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
  };

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

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white flex flex-col relative pb-safe">
      <header className="p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif text-yellow-500">THE COACH</h2>
          {loading ? (
            <div className="flex items-center gap-3 mt-1">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-6 w-32" />
            </div>
          ) : (
            <p className="text-zinc-500 text-xs">{profile?.name || '회원'} 님</p>
          )}
        </div>
        <button onClick={logout}>
          <LogOut size={20} className="text-zinc-600 hover:text-white transition-colors" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 w-full relative">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <button
            onClick={() => setShowQRModal(true)}
            className="relative w-48 h-48 rounded-full bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-2xl"
          >
            <QrCode size={40} className="text-yellow-500" />
            <span className="text-sm tracking-widest font-medium text-zinc-300">CHECK-IN</span>
          </button>
        </div>

        <div className="w-full max-w-xs space-y-2 mt-8">
          <ButtonGhost onClick={() => setView('library')}>LIBRARY</ButtonGhost>
          <ButtonGhost onClick={() => setView('class_booking')}>CLASS BOOKING</ButtonGhost>
          <ButtonGhost onClick={handleOpenSchedule}>MY SCHEDULE</ButtonGhost>
          <ButtonGhost onClick={() => setView('macro_calculator')}>MACRO CALCULATOR</ButtonGhost>
        </div>

        <button
          onClick={() => setShowHistory(true)}
          className="absolute bottom-6 left-6 text-left cursor-pointer group"
        >
          <p className="text-zinc-500 text-[10px] tracking-widest uppercase mb-1">Total Remaining</p>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-2xl font-serif text-white group-hover:text-yellow-500 transition-colors">
                {profile?.remaining_sessions || 0}
                <span className="text-xs font-sans text-zinc-500 ml-1 group-hover:text-zinc-400 transition-colors">
                  Sessions
                </span>
              </p>
              <span className="text-zinc-600 group-hover:text-yellow-500/80 transition-colors flex items-center gap-1 text-[10px] uppercase tracking-wider">
                <History size={12} /> History
              </span>
            </div>
          )}
        </button>
        <button onClick={() => setView('admin_home')}>Admin Home</button>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border-2 border-yellow-500 rounded-2xl p-8 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif text-yellow-500">CHECK-IN QR</h3>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="bg-white p-6 rounded-xl mb-6 flex items-center justify-center min-h-[280px] border-2 border-zinc-200">
                <div className="text-center">
                  {user?.id ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(user.id)}&size=200x200&format=png`}
                      alt="Check-in QR Code"
                      className="mx-auto mb-3 border-2 border-zinc-300 rounded-lg"
                    />
                  ) : (
                    <div className="w-[200px] h-[200px] bg-zinc-200 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-zinc-500 text-sm">Loading...</span>
                    </div>
                  )}
                  <p className="text-xs text-zinc-600 font-mono break-all px-4">{user?.id || 'Loading...'}</p>
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-zinc-400 text-sm">Name</span>
                  <span className="text-white font-bold">{profile?.name || 'Loading...'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Remaining Sessions</span>
                  <span className="text-2xl font-serif text-yellow-500">{profile?.remaining_sessions || 0}</span>
                </div>
              </div>

              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <div className="flex items-start gap-3">
                  <Sparkles size={20} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      관리자에게 이 화면을 보여주세요. QR 스캔 시 자동으로 세션이 차감됩니다.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowQRModal(false)}
                className="w-full mt-6 bg-yellow-600 text-white font-bold py-3 rounded-lg hover:bg-yellow-500 active:scale-95 transition-all"
              >
                CLOSE
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
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border-2 border-yellow-500 rounded-2xl p-6 max-w-md w-full max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-serif text-yellow-500">MY SCHEDULE</h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 mb-4">
                <button
                  onClick={() => {
                    const prev = new Date(currentWeekStart);
                    prev.setDate(prev.getDate() - 7);
                    setCurrentWeekStart(prev);
                  }}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-500 transition"
                >
                  <ChevronLeft size={24} />
                </button>
                <span className="text-sm font-bold text-white min-w-[180px] text-center">{weekLabel()}</span>
                <button
                  onClick={() => {
                    const next = new Date(currentWeekStart);
                    next.setDate(next.getDate() + 7);
                    setCurrentWeekStart(next);
                  }}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-500 transition"
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {loadingBookings ? (
                  <p className="text-zinc-500 text-center py-10">Loading...</p>
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
                          isToday ? 'bg-yellow-500/10 border-yellow-500/60' : 'bg-zinc-800/50 border-zinc-700'
                        }`}
                      >
                        <div
                          className={`px-4 py-2 flex items-center justify-between ${isToday ? 'bg-yellow-500/20' : 'bg-zinc-800/80'}`}
                        >
                          <span className="font-bold text-white">
                            {dayName} {dateStr}
                          </span>
                          {isToday && (
                            <span className="text-xs font-bold text-yellow-500 bg-yellow-500/30 px-2 py-0.5 rounded">
                              Today
                            </span>
                          )}
                        </div>
                        {dayBookings.length === 0 ? (
                          <div className="px-4 py-3 text-zinc-500 text-sm">Rest Day 💤</div>
                        ) : (
                          <div className="divide-y divide-zinc-700">
                            {dayBookings.map((booking) => (
                              <div key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="flex-1">
                                  <span className="text-2xl font-mono font-bold text-yellow-500">
                                    {formatTime24h(booking.time)}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleCancelBooking(booking.id, booking.date, booking.time)}
                                  disabled={cancelling === booking.id}
                                  className="p-2 rounded-lg bg-red-600/20 border border-red-600/30 text-red-500 hover:bg-red-600/30 active:scale-95 transition-all disabled:opacity-50"
                                  title="Cancel booking"
                                >
                                  <Trash2 size={18} />
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
                <p className="text-zinc-600 text-xs text-center mt-2">이번 주 예약이 없어요. CLASS BOOKING에서 예약해보세요!</p>
              )}

              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-full mt-4 bg-yellow-600 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 active:scale-95 transition-all"
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-zinc-900 border border-yellow-500/30 rounded-2xl shadow-2xl shadow-black/50 p-6 max-w-sm w-full"
            >
              <h3 className="text-lg font-serif text-yellow-500 mb-2">예약 취소</h3>
              <p className="text-zinc-400 text-sm mb-6">
                {bookingToDelete.date} {bookingToDelete.time} 수업 예약을 취소할까요?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setBookingToDelete(null);
                  }}
                  className="px-6 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-medium min-w-[80px]"
                >
                  취소
                </button>
                <button
                  onClick={confirmDeleteAction}
                  disabled={cancelling === bookingToDelete.id}
                  className="px-6 py-3 rounded-xl bg-yellow-600 text-black font-bold hover:bg-yellow-500 transition-all disabled:opacity-50 min-w-[80px]"
                >
                  {cancelling === bookingToDelete.id ? '처리 중...' : '예, 취소할게요'}
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
