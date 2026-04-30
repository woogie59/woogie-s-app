import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchMembersBalanceSummaries } from '../../utils/sessionHelpers';
import { SESSION_BALANCE_REFRESH_EVENT } from '../../utils/sessionBalanceEvents';
import BackButton from '../../components/ui/BackButton';
import Skeleton from '../../components/ui/Skeleton';

const MemberList = ({ setView, goBack, setSelectedMemberId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
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
    const summaries = await fetchMembersBalanceSummaries(supabase, ids);
    setUsers(
      list.map((p) => ({
        ...p,
        computedRemaining: summaries[p.id]?.remaining ?? 0,
      }))
    );
    setLoading(false);
  }, []);

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
        ) : users.length > 0 ? (
          users.map((u) => (
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
                <span className="rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 tabular-nums">
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
