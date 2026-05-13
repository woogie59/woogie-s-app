import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';
import AthleteStatusBoard from './AthleteStatusBoard';
import TitleArchiveModal from './TitleArchiveModal';
import HallOfFameLeaderboard from './HallOfFameLeaderboard';

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
        .select('id,name,member_level,current_title')
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
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  if (!profile.is_athlete_system_enabled) {
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
      className="relative min-h-screen max-h-[100dvh] w-full overflow-y-auto bg-[#050505] px-4 pb-20 pt-4 font-sans animate-in fade-in duration-1000 ease-out zoom-in-95 fill-mode-forwards"
    >
      <button
        type="button"
        aria-label="뒤로 가기"
        onClick={handleBack}
        className="absolute left-6 top-6 z-50 p-2 text-zinc-500 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
      </button>

      <div className="mx-auto flex min-h-[calc(100dvh-6.5rem)] w-full max-w-[420px] flex-col gap-6 pt-6">
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
          suppressRoadmapButton={false}
          hideTitleArchive
          roadmapOpen={roadmapOpen}
          onRoadmapOpenChange={setRoadmapOpen}
          onRepresentativeTitleClick={() => setIsTitleModalOpen(true)}
          representativeTitleDescription={representativeTitleDescription}
        />

        {/* Action group: Growth Record + Hall of Fame — tightly stacked */}
        <div className="flex flex-col gap-y-4 mt-2">
          <AthleteStatusBoard targetUserId={profile.id} ledgerRefreshKey={ledgerRefreshKey} />

          <div className="flex justify-center">
            <button
              type="button"
              aria-label="명예의 전당 열기"
              onClick={() => setHofOpen(true)}
              className="inline-flex items-center justify-center rounded-full border border-purple-500/20 bg-purple-900/10 px-6 py-3 text-xs tracking-[0.16em] text-purple-300/80 backdrop-blur-md transition-all hover:border-purple-500/40 hover:text-purple-200"
            >
              [ ✦ 명예의 전당 (Hall of Fame) ]
            </button>
          </div>
        </div>
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
