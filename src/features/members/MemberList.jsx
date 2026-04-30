import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchMembersBalanceSummaries } from '../../utils/sessionHelpers';
import { SESSION_BALANCE_REFRESH_EVENT } from '../../utils/sessionBalanceEvents';
import BackButton from '../../components/ui/BackButton';
import Skeleton from '../../components/ui/Skeleton';

const toDateKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const m = timeStr.trim().match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const isFutureScheduleRow = (row, now = new Date()) => {
  if (row?.status === 'cancelled') return false;
  const dateStr = String(row.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const todayKey = toDateKey(now);
  if (dateStr > todayKey) return true;
  if (dateStr < todayKey) return false;
  return parseTimeToMinutes(row.time) >= now.getHours() * 60 + now.getMinutes();
};

const MemberList = ({ setView, goBack, setSelectedMemberId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState('remaining_asc');
  const [filterMode, setFilterMode] = useState('all');
  const [summary, setSummary] = useState({ total: 0, lowCredit: 0, unbooked: 0 });
  const debounceRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    const { data: profiles, error } = await supabase.from('profiles').select('*').eq('role', 'user');
    if (error) {
      console.error(error);
      setUsers([]);
      setLoading(false);
      return;
    }
    const list = profiles || [];
    const ids = list.map((p) => p.id).filter(Boolean);
    const [summaries, bookingsRes] = await Promise.all([
      fetchMembersBalanceSummaries(supabase, ids),
      supabase.from('bookings').select('user_id, date, time, status').in('user_id', ids),
    ]);

    const bookings = bookingsRes.error ? [] : bookingsRes.data || [];
    const now = new Date();
    const hasFutureBooking = new Set();
    bookings.forEach((row) => {
      if (row?.user_id && isFutureScheduleRow(row, now)) {
        hasFutureBooking.add(row.user_id);
      }
    });

    const mapped = list.map((p) => ({
        ...p,
        computedRemaining: summaries[p.id]?.remaining ?? 0,
        hasFutureBooking: hasFutureBooking.has(p.id),
      }));
    setUsers(mapped);
    setSummary({
      total: mapped.length,
      lowCredit: mapped.filter((u) => (u.computedRemaining ?? 0) <= 5).length,
      unbooked: mapped.filter((u) => !u.hasFutureBooking).length,
    });
    setLoading(false);
  }, []);

  const filteredUsers = users
    .filter((u) => {
      if (filterMode === 'low_credit') return (u.computedRemaining ?? 0) <= 5;
      if (filterMode === 'unbooked') return !u.hasFutureBooking;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'remaining_asc') return (a.computedRemaining ?? 0) - (b.computedRemaining ?? 0);
      return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
    });

  const getRemainingBadgeClass = (remaining) => {
    if (remaining <= 2) return 'bg-red-100 text-red-700';
    if (remaining <= 9) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-50 text-emerald-700';
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const onRefresh = () => {
      void fetchUsers();
    };
    window.addEventListener(SESSION_BALANCE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(SESSION_BALANCE_REFRESH_EVENT, onRefresh);
  }, [fetchUsers]);

  useEffect(() => {
    const schedule = () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void fetchUsers();
      }, 400);
    };
    const ch = supabase
      .channel('member_list_session_balance_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_batches' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, schedule)
      .subscribe();
    return () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [fetchUsers]);

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 p-6">
      <BackButton onClick={goBack} />
      <div className="space-y-4 mt-8">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFilterMode('all')} className={`rounded-full px-2.5 py-1 ${filterMode === 'all' ? 'bg-white text-slate-900 border border-gray-200' : ''}`}>
            전체 회원 {summary.total}명
          </button>
          <span>|</span>
          <button type="button" onClick={() => setFilterMode('low_credit')} className={`rounded-full px-2.5 py-1 ${filterMode === 'low_credit' ? 'bg-white text-slate-900 border border-gray-200' : ''}`}>
            만료 임박(5회 이하) {summary.lowCredit}명
          </button>
          <span>|</span>
          <button type="button" onClick={() => setFilterMode('unbooked')} className={`rounded-full px-2.5 py-1 ${filterMode === 'unbooked' ? 'bg-white text-slate-900 border border-gray-200' : ''}`}>
            미예약 {summary.unbooked}명
          </button>
        </div>

        <div className="flex justify-end">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600"
          >
            <option value="remaining_asc">잔여 세션 적은 순</option>
            <option value="name_asc">이름순</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex justify-between items-center">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right space-y-1">
                    <Skeleton className="h-3 w-12 ml-auto" />
                    <Skeleton className="h-5 w-8 ml-auto" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded shrink-0" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((u) => (
            <div
              key={u.id}
              onClick={() => {
                setSelectedMemberId(u.id);
                setView('member_detail');
              }}
              className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center active:bg-gray-100 hover:border-emerald-600/30 transition-colors cursor-pointer"
            >
              <div>
                <h3 className="font-bold text-lg text-slate-900">{u.name}</h3>
              </div>
              <div className="flex items-center gap-4">
                <span className={`rounded-full text-xs font-semibold px-3 py-1.5 tabular-nums ${getRemainingBadgeClass(u.computedRemaining ?? 0)}`}>
                  잔여 {u.computedRemaining ?? 0}회
                </span>
                <ChevronRight size={20} className="text-gray-400" />
              </div>
            </div>
          ))
        ) : (
          <div className="text-gray-500 text-center py-10 flex flex-col items-center gap-2">
            <User size={40} className="opacity-20" />
            <p>등록된 회원이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberList;
