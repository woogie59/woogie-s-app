import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { deleteAttendanceLogsForBooking, toTime24h } from '../../utils/cascadeAttendance';
import BackButton from '../../components/ui/BackButton';
import Skeleton from '../../components/ui/Skeleton';

const toTime24h = (t) => {
  if (!t || typeof t !== 'string') return t || '—';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return t;
};

const AdminSchedule = ({ setView, goBack }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
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

  const fetchBookings = async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setBookings([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleDelete = async (booking) => {
    const bookingId = booking.id;
    const confirmDelete = window.confirm(
      '이 일정을 삭제하시겠습니까? 해당 시간은 즉시 개방됩니다.'
    );
    if (!confirmDelete) return;

    setDeletingId(bookingId);
    try {
      const targetUserId = booking.user_id;
      const targetTime = toTime24h(booking.time);

      console.log(`🗑️ 예약(ID: ${bookingId}) 삭제 시도…`, { targetUserId, targetTime });

      const { data: attData, error: attErr } = await deleteAttendanceLogsForBooking(supabase, booking);
      if (attErr) {
        console.error('[AdminSchedule] attendance_logs 삭제 실패:', attErr);
        window.alert('출석 기록 삭제 실패: ' + attErr.message);
        return;
      }
      console.log('[AdminSchedule] attendance_logs 삭제 결과(행):', attData?.length ?? 0);

      const { data: bookData, error: bookErr } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)
        .select();

      if (bookErr) {
        console.error('❌ bookings 삭제 실패:', bookErr);
        window.alert('예약 삭제 실패: ' + bookErr.message);
        return;
      }

      if (!bookData || bookData.length === 0) {
        window.alert('DB에서 삭제되지 않았습니다! (권한 또는 ID 문제)');
        return;
      }

      console.log('✅ bookings 삭제 확인:', bookData);
      setBookings((prev) => prev.filter((item) => item.id !== bookingId));
      window.alert('일정이 삭제되었습니다.');
    } catch (err) {
      console.error('🚨 예기치 못한 에러:', err);
      window.alert('삭제 중 예기치 못한 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
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
                            onClick={() => handleDelete(booking)}
                            disabled={deletingId === booking.id}
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

    </div>
  );
};

export default AdminSchedule;
