import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';

export default function MemberAthleteView({ userId, goBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entranceKey, setEntranceKey] = useState(0);

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
      setEntranceKey((k) => k + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen max-h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-obsidian text-zinc-400 flex items-center justify-center font-sans">
        불러오는 중...
      </div>
    );
  }

  if (!profile || String(profile.name || '').trim() !== '테스트용1') {
    return (
      <div className="min-h-screen max-h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-white text-slate-900 flex items-center justify-center px-6">
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
    <div
      key={entranceKey}
      className="min-h-screen max-h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-obsidian px-4 py-6 pb-32 font-sans animate-in fade-in duration-1000 ease-out zoom-in-95 fill-mode-forwards"
    >
      <button
        type="button"
        onClick={goBack}
        className="mb-4 text-sm font-semibold tracking-wide text-zinc-400 transition-colors hover:text-white"
      >
        {'< 돌아가기'}
      </button>
      <div className="w-full">
        <AthleteStatus
          memberId={profile.id}
          memberName={profile.name}
          memberLevel={profile.member_level ?? 1}
          memberTitle={profile.current_title ?? ''}
          subtitle="아틀리트 상태"
          epicLevelUpKey={0}
          viewMode="member"
        />
      </div>
    </div>
  );
}
