import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';
import MemberGrowthLedger from './MemberGrowthLedger';
import { MemberAcquiredTitlePills, MemberAthleteCoreStatsGrid } from './MemberAthleteMirrorSections';
import MasterExamPendingSanctum from './MasterExamPendingSanctum';

export default function MemberAthleteView({ userId, goBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entranceKey, setEntranceKey] = useState(0);
  const [memberStats, setMemberStats] = useState([]);
  const [ownedTitles, setOwnedTitles] = useState([]);
  const [loadingMirrorData, setLoadingMirrorData] = useState(true);
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [isMasterExamPending, setIsMasterExamPending] = useState(false);

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
      setOwnedTitles([]);
      setLoadingMirrorData(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMirrorData(true);
      const [statsRes, titlesRes] = await Promise.all([
        supabase.from('member_stats').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('member_titles').select('*').eq('user_id', userId).order('granted_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (statsRes.error) {
        console.error('[MemberAthleteView] member_stats', statsRes.error);
        setMemberStats([]);
      } else {
        setMemberStats(statsRes.data || []);
      }
      if (titlesRes.error) {
        console.error('[MemberAthleteView] member_titles', titlesRes.error);
        setOwnedTitles([]);
      } else {
        setOwnedTitles(titlesRes.data || []);
      }
      setLoadingMirrorData(false);
      setLedgerRefreshKey((k) => k + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setIsMasterExamPending(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_master_exam_status', {
        p_user_id: userId,
      });
      if (cancelled) return;
      if (!rpcErr && rpcData != null) {
        const status = String(typeof rpcData === 'string' ? rpcData : rpcData?.status ?? rpcData?.exam_status ?? '')
          .toLowerCase()
          .trim();
        setIsMasterExamPending(status === 'pending');
        return;
      }

      const { data: rows, error: rowErr } = await supabase
        .from('master_exam_requests')
        .select('status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (rowErr) {
        console.error('[MemberAthleteView] master_exam_requests', rowErr);
        setIsMasterExamPending(false);
        return;
      }
      const latestStatus = String(Array.isArray(rows) ? rows[0]?.status ?? '' : '').toLowerCase().trim();
      setIsMasterExamPending(latestStatus === 'pending');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!isTitleModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isTitleModalOpen]);

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

  if (isMasterExamPending) {
    return <MasterExamPendingSanctum fullScreen />;
  }

  return (
    <div
      key={entranceKey}
      className="min-h-screen max-h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-obsidian px-4 py-6 pb-28 font-sans animate-in fade-in duration-1000 ease-out zoom-in-95 fill-mode-forwards"
    >
      <button
        type="button"
        onClick={goBack}
        className="mb-4 text-sm font-semibold tracking-wide text-zinc-400 transition-colors hover:text-white"
      >
        {'< 돌아가기'}
      </button>

      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-10">
        <AthleteStatus
          memberId={profile.id}
          memberName={profile.name}
          memberLevel={profile.member_level ?? 1}
          memberTitle={profile.current_title ?? ''}
          subtitle="아틀리트 상태"
          epicLevelUpKey={0}
          viewMode="member"
          masterExamPendingFullBleed
          compactMemberHero
          suppressRoadmapButton
          hideTitleArchive
          roadmapOpen={roadmapOpen}
          onRoadmapOpenChange={setRoadmapOpen}
        />

        <section className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">코어 스탯</p>
          <MemberAthleteCoreStatsGrid stats={memberStats} loading={loadingMirrorData} />
        </section>

        <button
          type="button"
          onClick={() => setIsTitleModalOpen(true)}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 text-center text-xs font-semibold tracking-[0.16em] text-white/85 transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          [ ✦ 획득 칭호 확인하기 ]
        </button>

        <section>
          <p className="mb-3 text-center text-[11px] font-medium tracking-[0.2em] text-white/40">성장 기록</p>
          <MemberGrowthLedger targetUserId={profile.id} refreshKey={ledgerRefreshKey} />
        </section>

        <div className="flex justify-center pb-6 pt-2">
          <button
            type="button"
            aria-label="레벨 가이드 열기"
            onClick={() => setRoadmapOpen(true)}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs tracking-[0.16em] text-white/85 backdrop-blur-md transition-all hover:bg-white/10"
          >
            [ ✦ 아틀리트 계급 로드맵 ]
          </button>
        </div>
      </div>

      {isTitleModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="획득 칭호"
          onClick={() => setIsTitleModalOpen(false)}
        >
          <div
            className="max-h-[min(88dvh,640px)] w-full max-w-[400px] overflow-y-auto rounded-2xl border border-white/10 bg-[#050505] p-6 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-500">아카이브</p>
            <p className="mt-2 text-center text-sm font-semibold text-zinc-200">획득 칭호</p>
            <div className="mt-6">
              <MemberAcquiredTitlePills ownedTitles={ownedTitles} loading={loadingMirrorData} />
            </div>
            <button
              type="button"
              onClick={() => setIsTitleModalOpen(false)}
              className="mt-8 w-full rounded-xl border border-white/15 bg-white/5 py-3 text-center text-sm font-semibold tracking-wide text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
            >
              [ 닫기 (Close) ]
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
