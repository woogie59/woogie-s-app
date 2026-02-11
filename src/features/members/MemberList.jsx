import React, { useState, useEffect } from 'react';
import { User, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import BackButton from '../../components/ui/BackButton';
import Skeleton from '../../components/ui/Skeleton';

const MemberList = ({ setView, setSelectedMemberId }) => {
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
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-6">
      <BackButton onClick={() => setView('admin_home')} label="Admin Home" />

      <header className="flex items-center justify-between mb-8">
        <div></div>
        <h2 className="text-lg font-serif text-yellow-500">CLIENTS</h2>
        <div className="w-6"></div>
      </header>
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 flex justify-between items-center">
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
              className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex justify-between items-center active:bg-zinc-800 hover:border-yellow-600/30 transition-colors cursor-pointer"
            >
              <div>
                <h3 className="font-bold text-lg text-white">{u.name}</h3>
                <p className="text-zinc-500 text-xs mt-1">{u.email}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Remaining</span>
                  <span className="text-lg font-serif text-yellow-500">{u.remaining_sessions}</span>
                </div>
                <ChevronRight size={20} className="text-zinc-600" />
              </div>
            </div>
          ))
        ) : (
          <div className="text-zinc-500 text-center py-10 flex flex-col items-center gap-2">
            <User size={40} className="opacity-20" />
            <p>등록된 회원이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberList;
