import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ChevronRight, RotateCcw, ArrowDownAZ, ChevronsDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { fetchMembersBalanceSummaries } from '../../utils/sessionHelpers';
import { SESSION_BALANCE_REFRESH_EVENT } from '../../utils/sessionBalanceEvents';
import { useGlobalModal } from '../../context/GlobalModalContext';
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
  const { showConfirm } = useGlobalModal();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberTab, setMemberTab] = useState('active');
  const [sortBy, setSortBy] = useState('name');
  const [filterMode, setFilterMode] = useState('all');
  const [summary, setSummary] = useState({ total: 0, lowCredit: 0, unbooked: 0 });
  const [reactivatingId, setReactivatingId] = useState(null);
  const debounceRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    const statusFilter = memberTab === 'inactive' ? 'inactive' : 'active';
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'user')
      .eq('status', statusFilter);
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
  }, [memberTab]);

  const handleReactivate = (member, e) => {
    e.stopPropagation();
    showConfirm({
      title: '회원 복구',
      message: `${member.name || '회원'}을(를) 다시 활성화하시겠습니까?`,
      confirmLabel: '재활성',
      onConfirm: async () => {
        setReactivatingId(member.id);
        const { error } = await supabase.from('profiles').update({ status: 'active' }).eq('id', member.id);
        setReactivatingId(null);
        if (error) throw error;
        toast.success('회원이 활성화되었습니다.');
        void fetchUsers();
      },
    });
  };

  const filteredMembers = users.filter((u) => {
    if (memberTab === 'inactive') return true;
    if (filterMode === 'low_credit') return (u.computedRemaining ?? 0) <= 5;
    if (filterMode === 'unbooked') return !u.hasFutureBooking;
    return true;
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (memberTab === 'active') {
      const aExpired = (a.computedRemaining ?? 0) <= 0;
      const bExpired = (b.computedRemaining ?? 0) <= 0;
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
    }
    if (sortBy === 'level') {
      const aLevel = Number(a.member_level) || 1;
      const bLevel = Number(b.member_level) || 1;
      if (bLevel !== aLevel) return bLevel - aLevel;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
    }
    return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
  });

  const getRemainingBadgeClass = (remaining) => {
    if (remaining <= 2) return 'bg-red-100 text-red-700';
    if (remaining <= 9) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-50 text-emerald-700';
  };

  useEffect(() => {
    setLoading(true);
    setFilterMode('all');
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, schedule)
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
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMemberTab('active')}
            className={`flex-1 rounded-lg py-2 font-medium transition-colors active:scale-[0.98] ${
              memberTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            활성 회원
          </button>
          <button
            type="button"
            onClick={() => setMemberTab('inactive')}
            className={`flex-1 rounded-lg py-2 font-medium transition-colors active:scale-[0.98] ${
              memberTab === 'inactive' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            보관함/만료 회원
          </button>
        </div>

        {memberTab === 'active' && (
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
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">정렬</span>
          <div className="flex flex-1 max-w-sm rounded-xl border border-gray-200 bg-gray-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setSortBy('name')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-colors active:scale-[0.98] ${
                sortBy === 'name' ? 'bg-white text-slate-900 shadow-sm border border-gray-100' : 'text-gray-500'
              }`}
            >
              <ArrowDownAZ size={14} strokeWidth={1.5} className={sortBy === 'name' ? 'text-[#064e3b]' : 'text-gray-400'} />
              이름순 (가나다)
            </button>
            <button
              type="button"
              onClick={() => setSortBy('level')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-colors active:scale-[0.98] ${
                sortBy === 'level' ? 'bg-white text-slate-900 shadow-sm border border-gray-100' : 'text-gray-500'
              }`}
            >
              <ChevronsDown size={14} strokeWidth={1.5} className={sortBy === 'level' ? 'text-[#064e3b]' : 'text-gray-400'} />
              레벨순 (높은순)
            </button>
          </div>
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
        ) : sortedMembers.length > 0 ? (
          sortedMembers.map((u) => {
            const isExpired = memberTab === 'active' && (u.computedRemaining ?? 0) <= 0;
            return (
            <div
              key={u.id}
              onClick={() => {
                setSelectedMemberId(u.id);
                setView('member_detail');
              }}
              className={`bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center active:bg-gray-100 hover:border-emerald-600/30 transition-colors cursor-pointer ${isExpired ? 'opacity-60' : ''}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-slate-900">{u.name}</h3>
                  {sortBy === 'level' && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500">
                      Lv.{Number(u.member_level) || 1}
                    </span>
                  )}
                </div>
                {memberTab === 'inactive' && (
                  <p className="text-xs text-gray-400 mt-0.5">비활성 · 데이터 보존됨</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {memberTab === 'inactive' ? (
                  <button
                    type="button"
                    onClick={(e) => handleReactivate(u, e)}
                    disabled={reactivatingId === u.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#064e3b]/30 px-3 py-1.5 text-xs font-semibold text-[#064e3b] hover:bg-emerald-50 transition-colors active:scale-[0.98] disabled:opacity-50"
                  >
                    <RotateCcw size={14} strokeWidth={1.5} />
                    {reactivatingId === u.id ? '처리 중…' : '복구/재활성'}
                  </button>
                ) : (
                  <span className={`rounded-full text-xs font-semibold px-3 py-1.5 tabular-nums ${getRemainingBadgeClass(u.computedRemaining ?? 0)}`}>
                    잔여 {u.computedRemaining ?? 0}회
                  </span>
                )}
                <ChevronRight size={20} className="text-gray-400 shrink-0" />
              </div>
            </div>
            );
          })
        ) : (
          <div className="text-gray-500 text-center py-10 flex flex-col items-center gap-2">
            <User size={40} className="opacity-20" />
            <p>{memberTab === 'inactive' ? '보관된 회원이 없습니다.' : '등록된 회원이 없습니다.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberList;
