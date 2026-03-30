import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, LogOut, X, ChevronLeft, ChevronRight, Trash2, History } from 'lucide-react';
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
    <div className="min-h-[100dvh] bg-white text-slate-900 flex flex-col relative pb-safe">
      <header className="p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif text-emerald-600">THE COACH</h2>
          {loading ? (
            <div className="flex items-center gap-3 mt-1">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-6 w-32" />
            </div>
          ) : (
            <p className="text-gray-500 text-xs">{profile?.name || '회원'} 님</p>
          )}
        </div>
        <button onClick={logout}>
          <LogOut size={20} className="text-gray-600 hover:text-slate-900 transition-colors" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 w-full relative">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-green-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <button
            onClick={() => setShowQRModal(true)}
            className="relative w-48 h-48 rounded-full bg-white border border-gray-200 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
          >
            <QrCode size={40} className="text-emerald-600" />
            <span className="text-sm tracking-widest font-medium text-gray-600">CHECK-IN</span>
          </button>
        </div>

        <div className="w-full max-w-xs space-y-2 mt-8">
          <ButtonGhost onClick={() => setView('library')}>LIBRARY</ButtonGhost>
          <ButtonGhost onClick={() => setView('class_booking')}>CLASS BOOKING</ButtonGhost>
          <ButtonGhost onClick={handleOpenSchedule}>MY SCHEDULE</ButtonGhost>
        </div>

        <button
          onClick={() => setShowHistory(true)}
          className="absolute bottom-6 left-6 text-left cursor-pointer group"
        >
          <p className="text-gray-500 text-[10px] tracking-widest uppercase mb-1">Total Remaining</p>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-2xl font-serif text-slate-900 group-hover:text-emerald-600 transition-colors">
                {profile?.remaining_sessions || 0}
                <span className="text-xs font-sans text-gray-500 ml-1 group-hover:text-gray-400 transition-colors">
                  Sessions
                </span>
              </p>
              <span className="text-gray-600 group-hover:text-emerald-600/80 transition-colors flex items-center gap-1 text-[10px] uppercase tracking-wider">
                <History size={12} /> History
              </span>
            </div>
          )}
        </button>
        {profile?.role === 'admin' && (
          <button
            type="button"
            onClick={() => setView('admin_home')}
            className="absolute bottom-6 right-6 text-[10px] tracking-widest uppercase text-gray-400 hover:text-emerald-600 transition-colors"
          >
            Admin Home
          </button>
        )}
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/20"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-emerald-600/30 rounded-2xl p-8 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif text-emerald-600">CHECK-IN QR</h3>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="text-gray-600 hover:text-slate-900 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex flex-col items-center mb-6">
                <p className="text-[10px] text-emerald-600 tracking-[0.2em] uppercase font-medium mb-3">
                  MEMBERSHIP PASS
                </p>
                <div className="bg-[#FFFEF5] border border-emerald-600/30 rounded-2xl p-8 shadow-xl shadow-gray-900/10 flex items-center justify-center w-full max-w-[280px]">
                  {user?.id ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(user.id)}&size=200x200&format=png&color=18181b&bgcolor=fffef5`}
                      alt="Check-in QR Code"
                      className="rounded-lg"
                    />
                  ) : (
                    <div className="w-[200px] h-[200px] bg-gray-200/70 rounded-lg flex items-center justify-center border border-gray-300">
                      <span className="text-gray-500 text-sm">Loading...</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Name</span>
                  <span className="text-slate-900 font-bold">{profile?.name || 'Loading...'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Remaining Sessions</span>
                  <span className="text-2xl font-serif text-emerald-600">{profile?.remaining_sessions || 0}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="w-full mt-6 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-500 active:scale-95 transition-all shadow-md shadow-emerald-600/20"
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
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/20"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-emerald-600/30 rounded-2xl p-6 max-w-md w-full max-h-[85vh] flex flex-col shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-serif text-emerald-600">MY SCHEDULE</h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-600 hover:text-slate-900 transition-colors"
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
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-emerald-600 transition"
                >
                  <ChevronLeft size={24} />
                </button>
                <span className="text-sm font-bold text-slate-900 min-w-[180px] text-center">{weekLabel()}</span>
                <button
                  onClick={() => {
                    const next = new Date(currentWeekStart);
                    next.setDate(next.getDate() + 7);
                    setCurrentWeekStart(next);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-emerald-600 transition"
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {loadingBookings ? (
                  <p className="text-gray-600 text-center py-10">Loading...</p>
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
                          isToday ? 'bg-emerald-600/10 border-emerald-600/30' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div
                          className={`px-4 py-2 flex items-center justify-between ${
                            isToday ? 'bg-emerald-600/15' : 'bg-gray-50'
                          }`}
                        >
                          <span className="font-bold text-slate-900">
                            {dayName} {dateStr}
                          </span>
                          {isToday && (
                            <span className="text-xs font-bold text-white bg-emerald-600/90 px-2 py-0.5 rounded">
                              Today
                            </span>
                          )}
                        </div>
                        {dayBookings.length === 0 ? (
                          <div className="px-4 py-3 text-gray-600 text-sm">Rest Day 💤</div>
                        ) : (
                          <div className="divide-y divide-gray-200">
                            {dayBookings.map((booking) => (
                              <div key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="flex-1">
                                  <span className="text-2xl font-mono font-bold text-emerald-600">
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
                <p className="text-gray-600 text-xs text-center mt-2">이번 주 예약이 없어요. CLASS BOOKING에서 예약해보세요!</p>
              )}

              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-full mt-4 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-500 active:scale-95 transition-all"
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/20"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-white border border-emerald-600/20 rounded-2xl shadow-xl shadow-gray-900/10 p-6 max-w-sm w-full"
            >
              <h3 className="text-lg font-serif text-emerald-600 mb-2">예약 취소</h3>
              <p className="text-gray-600 text-sm mb-6">
                {bookingToDelete.date} {bookingToDelete.time} 수업 예약을 취소할까요?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setBookingToDelete(null);
                  }}
                  className="px-6 py-3 rounded-xl text-gray-600 hover:text-slate-900 hover:bg-gray-100 transition-all font-medium min-w-[80px]"
                >
                  취소
                </button>
                <button
                  onClick={confirmDeleteAction}
                  disabled={cancelling === bookingToDelete.id}
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all disabled:opacity-50 min-w-[80px]"
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
