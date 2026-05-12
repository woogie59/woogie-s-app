import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';
import AthleteStatusBoard from './AthleteStatusBoard';
import TitleArchiveModal from './TitleArchiveModal';

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
          style={{ fontSize: '13vw', letterSpacing: '0.15em', whiteSpace: 'nowrap', display: 'block', margin: '0 auto', width: '100%' }}
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

  if (!profile || String(profile.name || '').trim() !== '테스트용1') {
    return (
      <div className="relative min-h-screen max-h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-white px-6 text-slate-900">
        <button
          type="button"
          aria-label="뒤로 가기"
          onClick={handleBack}
          className="absolute left-6 top-6 z-50 p-2 text-zinc-500 transition-colors hover:text-zinc-800"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
        </button>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-slate-500">명예의 전당 테스트 권한이 없습니다.</p>
            <button
              type="button"
              onClick={handleBack}
              className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm text-slate-700"
            >
              돌아가기
            </button>
          </div>
        </div>
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
      className="relative min-h-screen max-h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-[#050505] px-4 pb-20 pt-4 font-sans animate-in fade-in duration-1000 ease-out zoom-in-95 fill-mode-forwards"
    >
      <button
        type="button"
        aria-label="뒤로 가기"
        onClick={handleBack}
        className="absolute left-6 top-6 z-50 p-2 text-zinc-500 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
      </button>

      <div className="mx-auto flex min-h-[calc(100dvh-6.5rem)] w-full max-w-[420px] flex-col gap-10 pt-10">
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
          onRepresentativeTitleClick={() => setIsTitleModalOpen(true)}
          representativeTitleDescription={representativeTitleDescription}
        />

        <div className="flex justify-center pt-2">
          <button
            type="button"
            aria-label="계급표 열기"
            onClick={() => setRoadmapOpen(true)}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs tracking-[0.16em] text-white/85 backdrop-blur-md transition-all hover:bg-white/10"
          >
            [ ✦ 계급표 ]
          </button>
        </div>

        <div className="space-y-10">
          <AthleteStatusBoard targetUserId={profile.id} ledgerRefreshKey={ledgerRefreshKey} />
        </div>
      </div>

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
