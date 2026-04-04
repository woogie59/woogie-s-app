import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import BackButton from '../../components/ui/BackButton';
import Skeleton from '../../components/ui/Skeleton';

const toTime24h = (t) => {
  if (!t || typeof t !== 'string') return t || '—';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return t;
};

const AdminSchedule = ({ setView, goBack }) => {
  const { showAlert } = useGlobalModal();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const [expandedScheduleDates, setExpandedScheduleDates] = useState(new Set());

  const bookingsByDate = useMemo(() => {
    const map = {};
    (bookings || []).forEach((b) => {
      const key = b.date;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')));
    return map;
  }, [bookings]);

  const scheduleDatesSorted = useMemo(() => Object.keys(bookingsByDate).sort(), [bookingsByDate]);

  const toggleScheduleDateExpanded = (key) => {
    setExpandedScheduleDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (scheduleDatesSorted.length > 0) {
      setExpandedScheduleDates(new Set(scheduleDatesSorted));
    }
  }, [scheduleDatesSorted]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(name, email)')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error('[AdminSchedule] fetch error:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = (bookingId, userName, date, time) => {
    setBookingToDelete({ id: bookingId, userName, date, time });
    setIsCancelModalOpen(true);
  };

  const confirmCancelAction = async () => {
    if (!bookingToDelete) return;
    setCancelling(bookingToDelete.id);
    const { error } = await supabase.from('bookings').delete().eq('id', bookingToDelete.id);

    if (error) {
      showAlert({ message: 'Error cancelling booking: ' + error.message });
    } else {
      setIsCancelModalOpen(false);
      setBookingToDelete(null);
      setCancelling(null);
      fetchBookings();
      showAlert({ message: '취소가 완료되었습니다.', confirmLabel: '확인' });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 p-6 pb-20">
      <BackButton onClick={goBack} />

      <header className="flex items-center justify-center mb-6">
        <h2 className="text-lg font-serif text-emerald-600">ALL SCHEDULES</h2>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded shrink-0" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-5 w-5 rounded shrink-0" />
              </div>
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[75%]" />
              </div>
            </div>
          ))}
        </div>
      ) : bookings.length > 0 ? (
        <div className="space-y-3">
          {scheduleDatesSorted.map((dateKey) => {
            const dayBookings = bookingsByDate[dateKey] || [];
            const isExpanded = expandedScheduleDates.has(dateKey);
            return (
              <div key={dateKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleScheduleDateExpanded(dateKey)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-100/70 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-900">{dateKey}</span>
                    <span className="text-gray-500 text-sm">({dayBookings.length} bookings)</span>
                  </div>
                  {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-200 divide-y divide-gray-200">
                    {dayBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex justify-between items-center gap-4 p-4 bg-gray-50/70 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 truncate">{booking.profiles?.name || 'Unknown User'}</h3>
                          <p className="text-gray-500 text-xs truncate">{booking.profiles?.email || '-'}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-2 text-emerald-600 font-mono text-sm">
                            <Clock size={14} />
                            <span>{toTime24h(booking.time)}</span>
                          </div>
                          <button
                            onClick={() =>
                              handleCancelBooking(
                                booking.id,
                                booking.profiles?.name || 'User',
                                booking.date,
                                booking.time
                              )
                            }
                            disabled={cancelling === booking.id}
                            className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar size={64} className="text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-500 mb-2">No Bookings</h3>
          <p className="text-sm text-gray-600">No scheduled classes yet</p>
        </div>
      )}

      <AnimatePresence>
        {isCancelModalOpen && bookingToDelete && (
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
                {bookingToDelete.userName}님의 {bookingToDelete.date} {bookingToDelete.time} 예약을 취소할까요?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsCancelModalOpen(false);
                    setBookingToDelete(null);
                  }}
                  className="px-6 py-3 rounded-xl text-gray-600 hover:text-emerald-700 hover:bg-gray-100 transition-all font-medium min-w-[80px]"
                >
                  취소
                </button>
                <button
                  onClick={confirmCancelAction}
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

export default AdminSchedule;
