import React, { useCallback, useEffect, useState } from 'react';
import { Crown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function HallOfFameHub({ setView, setSelectedMemberId, goBack }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,member_level,current_title')
      .eq('role', 'user')
      .order('name', { ascending: true });
    setLoading(false);
    if (error) {
      console.error('[HallOfFameHub] profiles', error);
      setMembers([]);
      return;
    }
    setMembers(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return (
    <div className="min-h-[100dvh] bg-[#050505] px-6 py-8 text-white [font-family:Urbanist,sans-serif]">
      <button
        type="button"
        onClick={goBack}
        className="text-sm font-semibold tracking-wide text-zinc-400 transition hover:text-white"
      >
        {'< 돌아가기'}
      </button>

      <div className="mt-6 rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">아틀리트 명예의 전당</p>
        <p className="mt-2 text-sm text-zinc-500">다크 매터 컨트롤 허브에서 회원을 선택하세요.</p>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-zinc-500">표시할 회원이 없습니다.</p>
        ) : (
          members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if ((m.name || '').trim() !== '테스트용1') {
                  toast('현재 명예의 전당 테스트는 테스트용1 계정만 입장 가능합니다.');
                  return;
                }
                setSelectedMemberId(m.id);
                sessionStorage.setItem('hall_of_fame_member_id', m.id);
                setView('hall_of_fame_member');
              }}
              className="w-full rounded-2xl border border-white/5 bg-zinc-900/40 p-4 text-left shadow-2xl backdrop-blur-xl transition hover:border-zinc-400/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-wide text-zinc-100">{m.name || '회원'}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    LV. {Number(m.member_level) || 1}
                    {m.current_title ? ` · ${m.current_title}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Crown size={14} />
                  <ChevronRight size={16} />
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

