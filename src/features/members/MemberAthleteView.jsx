import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';
import AthleteStatusBoard from './AthleteStatusBoard';
import TitleArchiveModal from './TitleArchiveModal';
import HallOfFameLeaderboard from './HallOfFameLeaderboard';
import { markAthleteBoardSeen, fetchAthleteBoardSignals, hasUnreadAthleteGrowth, hasUnreadAthleteTitles, markAthleteGrowthSeen, markAthleteTitlesSeen, AthleteSectionNewBadge } from '../../utils/athleteBoardNotifications';

function MasterPendingCinematicView({ onBack }) {
  return (
    <div className="relative min-h-screen w-full bg-[#050505] font-sans text-white">
      <button
        type="button"
        aria-label="뒤로 가기"
        onClick={onBack}
        className="absolute left-6 top-6 z-50 p-2 text-zinc-600 transition-colors hover:text-zinc-300"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
      </button>
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <h1
          className="font-black bg-gradient-to-b from-purple-400 via-purple-700 to-black bg-clip-text text-transparent text-center drop-shadow-[0_0_40px_rgba(168,85,247,0.7)]"
          style={{ fontSize: 'clamp(3rem, 18vw, 9rem)', letterSpacing: '0.05em', whiteSpace: 'nowrap', display: 'block' }}
          aria-hidden
        >
          MASTER
        </h1>
        <div className="mt-6 text-sm font-semibold tracking-[0.3em] text-purple-400 opacity-80">
          U N D E R&nbsp;J U D G E M E N T
        </div>
      </div>
    </div>
  );
}

export default function MemberAthleteView({ userId, goBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entranceKey, setEntranceKey] = useState(0);
  const [ownedTitles, setOwnedTitles] = useState([]);
  const [titleDefinitions, setTitleDefinitions] = useState([]);
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [masterExamRequestStatus, setMasterExamRequestStatus] = useState('idle');
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [hofOpen, setHofOpen] = useState(false);
  const [boardSignals, setBoardSignals] = useState(null);

  const refreshBoardSignals = useCallback(async () => {
    if (!userId) return;
    const signals = await fetchAthleteBoardSignals(userId);
    if (signals) setBoardSignals(signals);
  }, [userId]);

  const hasGrowthNew = hasUnreadAthleteGrowth(boardSignals);
  const hasTitlesNew = hasUnreadAthleteTitles(boardSignals);

  const openTitleArchive = () => {
    setIsTitleModalOpen(true);
    void markAthleteTitlesSeen(userId).then(() => refreshBoardSignals());
  };

  const handleGrowthOpened = () => {
    void markAthleteGrowthSeen(userId).then(() => refreshBoardSignals());
  };

  const handleBack = () => {
    if (typeof goBack === 'function') {
      goBack();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  /** Single orchestrated load: pending master → skip member_titles (no leak). */
  useEffect(() => {
    if (!userId) return undefined;
    void markAthleteBoardSeen();
    void refreshBoardSignals();

    const ch = supabase
      .channel(`athlete-board-signals:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        () => { void refreshBoardSignals(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'growth_records', filter: `user_id=eq.${userId}` },
        () => { void refreshBoardSignals(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'member_titles', filter: `user_id=eq.${userId}` },
        () => { void refreshBoardSignals(); }
      )
      .subscribe();

    const poll = window.setInterval(() => { void refreshBoardSignals(); }, 12000);

    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [userId, refreshBoardSignals]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setOwnedTitles([]);
      setMasterExamRequestStatus('idle');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setOwnedTitles([]);
      setMasterExamRequestStatus('idle');

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id,name,member_level,current_title,is_athlete_system_enabled')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (profErr) {
        console.error('[MemberAthleteView] profile load', profErr);
        setProfile(null);
        setLoading(false);
        return;
      }
      setProfile(prof || null);

      let masterStatus = 'idle';
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_master_exam_status', {
        p_user_id: userId,
      });
      if (!cancelled && !rpcErr && rpcData != null) {
        masterStatus = String(
          typeof rpcData === 'string' ? rpcData : rpcData?.status ?? rpcData?.exam_status ?? ''
        )
          .toLowerCase()
          .trim();
        masterStatus = masterStatus || 'idle';
      } else if (!cancelled) {
        const { data: rows, error: rowErr } = await supabase
          .from('master_exam_requests')
          .select('status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!rowErr && Array.isArray(rows) && rows[0]) {
          masterStatus = String(rows[0].status ?? '')
            .toLowerCase()
            .trim();
        } else if (rowErr) {
          console.error('[MemberAthleteView] master_exam_requests', rowErr);
        }
      }
      if (cancelled) return;
      setMasterExamRequestStatus(masterStatus);

      const levelNum = Number(prof?.member_level);
      const isPendingMaster = levelNum === 10 && masterStatus === 'pending';

      if (!isPendingMaster) {
        const [titlesRes, defsRes] = await Promise.all([
          supabase
            .from('member_titles')
            .select('*')
            .eq('user_id', userId)
            .order('granted_at', { ascending: false }),
          supabase.from('title_definitions').select('*').order('id', { ascending: true }),
        ]);
        if (cancelled) return;
        if (titlesRes.error) {
          console.error('[MemberAthleteView] member_titles', titlesRes.error);
          setOwnedTitles([]);
        } else {
          setOwnedTitles(titlesRes.data || []);
        }
        if (defsRes.error) {
          console.error('[MemberAthleteView] title_definitions', defsRes.error);
          setTitleDefinitions([]);
        } else {
          setTitleDefinitions(defsRes.data || []);
        }
        setLedgerRefreshKey((k) => k + 1);
      } else {
        setOwnedTitles([]);
        setTitleDefinitions([]);
      }

      setLoading(false);
      setEntranceKey((k) => k + 1);
      void refreshBoardSignals();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshBoardSignals]);

  if (loading) {
    return (
      <div className="relative min-h-screen max-h-[100dvh] w-full overflow-hidden bg-[#050505] font-sans text-zinc-400">
        <button
          type="button"
          aria-label="뒤로 가기"
          onClick={handleBack}
          className="absolute left-6 top-6 z-50 p-2 text-zinc-500 transition-colors hover:text-white"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
        </button>
        <div className="flex min-h-screen items-center justify-center">불러오는 중...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-zinc-500 px-6 text-center">
        <p className="text-sm">회원 정보를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-6 px-4 py-2 border border-zinc-700 rounded-md text-zinc-300 text-sm transition hover:border-zinc-500"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const hasAthleteAccess =
    profile.is_athlete_system_enabled === true ||
    profile.is_athlete_system_enabled === 'true';

  if (!hasAthleteAccess) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-zinc-500 px-6 text-center">
        <p>아틀리트 시스템 접근 권한이 없습니다.</p>
        <p className="text-sm mt-2">담당 트레이너에게 문의해주세요.</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-6 px-4 py-2 border border-zinc-700 rounded-md text-zinc-300 text-sm transition hover:border-zinc-500"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const shouldShowMasterSanctum = Number(profile.member_level) === 10 && masterExamRequestStatus === 'pending';
  if (shouldShowMasterSanctum) {
    return <MasterPendingCinematicView onBack={handleBack} />;
  }

  const representativeTitleDescription = (() => {
    const currentTitle = String(profile?.current_title || '').trim();
    if (!currentTitle) return '';
    const def = (titleDefinitions || []).find((row) => String(row?.title || row?.name || '').trim() === currentTitle);
    return String(def?.description || '').trim();
  })();

  return (
    <div
      key={entranceKey}
      className="relative min-h-[100dvh] w-full overflow-y-auto bg-[#050505] px-4 pt-4 font-sans flex flex-col animate-in fade-in duration-1000 ease-out zoom-in-95 fill-mode-forwards"
    >
      {/* Back button — absolute left */}
      <button
        type="button"
        aria-label="뒤로 가기"
        onClick={handleBack}
        className="absolute left-4 top-4 z-50 p-2 text-zinc-500 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
      </button>

      {/* Rank guide — absolute top-right (subtle pill) */}
      <button
        type="button"
        aria-label="계급표 열기"
        onClick={() => setRoadmapOpen(true)}
        className="absolute top-4 right-4 z-10 inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[11px] tracking-[0.12em] text-zinc-400 backdrop-blur-md transition hover:border-zinc-600 hover:text-zinc-200"
      >
        ✦ 계급표
      </button>

      {/* Hero section — grows to fill, centered */}
      <div className="flex-1 flex flex-col items-center w-full max-w-[420px] mx-auto pt-10">
        <AthleteStatus
          memberId={profile.id}
          memberName={profile.name}
          memberLevel={profile.member_level ?? 1}
          memberTitle={profile.current_title ?? ''}
          subtitle=""
          epicLevelUpKey={0}
          viewMode="member"
          masterExamPendingFullBleed
          compactMemberHero
          suppressRoadmapButton
          hideTitleArchive
          roadmapOpen={roadmapOpen}
          onRoadmapOpenChange={setRoadmapOpen}
          onRepresentativeTitleClick={openTitleArchive}
          representativeTitleDescription={representativeTitleDescription}
        />
      </div>

      {/* Action buttons — pushed to absolute bottom */}
      <div className="mt-auto pt-6 pb-12 w-full max-w-[420px] mx-auto flex flex-col gap-3 z-10">
        <button
          type="button"
          onClick={openTitleArchive}
          className={`relative w-full rounded-xl border px-3 py-3.5 text-sm font-semibold transition ${
            hasTitlesNew
              ? 'border-emerald-400/60 bg-emerald-950/30 text-emerald-50 ring-2 ring-emerald-400/30 shadow-[0_0_16px_rgba(16,185,129,0.15)]'
              : 'border-white/8 bg-white/[0.02] text-white/60 hover:border-white/15 hover:text-white/80'
          }`}
        >
          <span className="flex items-center justify-center gap-2 flex-wrap">
            <span>[ ✦ 나의 칭호 목록 ]</span>
            {hasTitlesNew ? (
              <>
                <AthleteSectionNewBadge />
                <span className="text-[10px] font-normal text-emerald-300/80">칭호 업데이트</span>
              </>
            ) : null}
          </span>
        </button>

        <AthleteStatusBoard
          targetUserId={profile.id}
          ledgerRefreshKey={ledgerRefreshKey}
          hasGrowthNew={hasGrowthNew}
          onGrowthOpened={handleGrowthOpened}
        />

        <button
          type="button"
          aria-label="명예의 전당 열기"
          onClick={() => setHofOpen(true)}
          className="w-full rounded-xl border border-purple-500/15 bg-purple-900/8 px-3 py-3 text-sm font-semibold tracking-[0.08em] text-purple-300/70 transition hover:border-purple-500/30 hover:text-purple-200"
        >
          [ ✦ 명예의 전당 ]
        </button>
      </div>

      <HallOfFameLeaderboard isOpen={hofOpen} onClose={() => setHofOpen(false)} />

      <TitleArchiveModal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        memberId={profile.id}
        acquiredTitles={ownedTitles}
        onRepresentativeChange={({ title }) => {
          setProfile((prev) => (prev ? { ...prev, current_title: String(title || '') } : prev));
        }}
      />
    </div>
  );
}
