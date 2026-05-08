import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';

export default function MemberAthleteView({ userId, goBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id,name,member_level,current_title')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[MemberAthleteView] profile load', error);
        setProfile(null);
      } else {
        setProfile(data || null);
      }
      setLoading(false);
      setAnimKey((k) => k + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <div className="min-h-[100dvh] bg-[#050505] text-zinc-400 flex items-center justify-center">불러오는 중...</div>;
  }

  if (!profile || String(profile.name || '').trim() !== '테스트용1') {
    return (
      <div className="min-h-[100dvh] bg-white text-slate-900 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-slate-500">명예의 전당 테스트 권한이 없습니다.</p>
          <button
            type="button"
            onClick={goBack}
            className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm text-slate-700"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div key={animKey} className="min-h-[100dvh] bg-[#050505] px-4 py-6 [font-family:Urbanist,sans-serif] animate-in fade-in duration-1000 ease-out zoom-in-95 fill-mode-forwards">
      <button
        type="button"
        onClick={goBack}
        className="mb-4 text-sm font-semibold tracking-wide text-zinc-400 transition-colors hover:text-white"
      >
        {'< 돌아가기'}
      </button>
      <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-white/5 bg-zinc-900/30 p-3 shadow-2xl backdrop-blur-xl">
        <AthleteStatus
          memberId={profile.id}
          memberName={profile.name}
          memberLevel={profile.member_level ?? 1}
          memberTitle={profile.current_title ?? ''}
          subtitle="아틀리트 상태"
          epicLevelUpKey={animKey}
        />
      </div>
    </div>
  );
}

