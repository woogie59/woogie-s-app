import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';
import MemberGrowthLedger from './MemberGrowthLedger';
import { MemberAthleteCoreStatsGrid, MemberAthleteTitleBoardReadOnly } from './MemberAthleteMirrorSections';

export default function MemberAthleteView({ userId, goBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entranceKey, setEntranceKey] = useState(0);
  const [memberStats, setMemberStats] = useState([]);
  const [titleDefinitions, setTitleDefinitions] = useState([]);
  const [ownedTitles, setOwnedTitles] = useState([]);
  const [loadingMirrorData, setLoadingMirrorData] = useState(true);
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);

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

  useEffect(() => {
    if (!userId) {
      setMemberStats([]);
      setTitleDefinitions([]);
      setOwnedTitles([]);
      setLoadingMirrorData(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMirrorData(true);
      const [statsRes, defsRes, titlesRes] = await Promise.all([
        supabase.from('member_stats').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('title_definitions').select('*').order('id', { ascending: true }),
        supabase.from('member_titles').select('*').eq('user_id', userId).order('granted_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setMemberStats(statsRes.error ? [] : statsRes.data || []);
      setTitleDefinitions(defsRes.error ? [] : defsRes.data || []);
      setOwnedTitles(titlesRes.error ? [] : titlesRes.data || []);
      setLoadingMirrorData(false);
      setLedgerRefreshKey((k) => k + 1);
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

      <div className="mx-auto w-full max-w-[420px] space-y-8">
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/30 shadow-2xl backdrop-blur-xl">
          <div className="space-y-6 px-1 pb-6 pt-2">
            <AthleteStatus
              memberId={profile.id}
              memberName={profile.name}
              memberLevel={profile.member_level ?? 1}
              memberTitle={profile.current_title ?? ''}
              subtitle="아틀리트 상태"
              epicLevelUpKey={0}
            />

            <div className="px-2">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
                <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">획득 칭호 · 아카이브</p>
                <MemberAthleteTitleBoardReadOnly
                  titleDefinitions={titleDefinitions}
                  ownedTitles={ownedTitles}
                  loading={loadingMirrorData}
                />
              </div>
            </div>

            <div className="px-2">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
                <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">코어 스탯</p>
                <p className="mt-1 text-center text-[10px] text-zinc-600">5대 바이오 메트릭 · 관리자와 동일 데이터</p>
                <MemberAthleteCoreStatsGrid stats={memberStats} loading={loadingMirrorData} />
              </div>
            </div>

            <div className="px-2 pb-2">
              <p className="mb-3 text-center text-[11px] font-medium tracking-[0.2em] text-white/40">성장 기록</p>
              <MemberGrowthLedger targetUserId={profile.id} refreshKey={ledgerRefreshKey} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
