import React, { useState, useEffect } from 'react';
import { User, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import BackButton from '../../components/ui/BackButton';
import Skeleton from '../../components/ui/Skeleton';

const MemberList = ({ setView, goBack, setSelectedMemberId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'user');
      if (error) console.error(error);
      else setUsers(data);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 p-6">
      <BackButton onClick={goBack} />

      <header className="flex items-center justify-between mb-8">
        <div></div>
        <h2 className="text-lg font-serif text-emerald-600">MEMBERS</h2>
        <div className="w-6"></div>
      </header>
      <div className="space-y-4">
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
                <p className="text-gray-500 text-xs mt-1">{u.email}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Remaining</span>
                  <span className="text-lg font-serif text-emerald-600">{u.remaining_sessions}</span>
                </div>
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
