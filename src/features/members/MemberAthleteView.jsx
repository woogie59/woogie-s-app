import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';
import MasterExamPendingSanctum from './MasterExamPendingSanctum';
import AthleteStatusBoard from './AthleteStatusBoard';
import TitleArchiveModal from './TitleArchiveModal';

export default function MemberAthleteView({ userId, goBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entranceKey, setEntranceKey] = useState(0);
  const [ownedTitles, setOwnedTitles] = useState([]);
  const [loadingMirrorData, setLoadingMirrorData] = useState(true);
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [masterExamRequestStatus, setMasterExamRequestStatus] = useState('idle');
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);

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
      setOwnedTitles([]);
      setLoadingMirrorData(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMirrorData(true);
      const { data: titlesData, error: titlesErr } = await supabase
        .from('member_titles')
        .select('*')
        .eq('user_id', userId)
        .order('granted_at', { ascending: false });
      if (cancelled) return;
      if (titlesErr) {
        console.error('[MemberAthleteView] member_titles', titlesErr);
        setOwnedTitles([]);
      } else {
        setOwnedTitles(titlesData || []);
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
      setMasterExamRequestStatus('idle');
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
        setMasterExamRequestStatus(status || 'idle');
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
        setMasterExamRequestStatus('idle');
        return;
      }
      const latestStatus = String(Array.isArray(rows) ? rows[0]?.status ?? '' : '').toLowerCase().trim();
      setMasterExamRequestStatus(latestStatus || 'idle');
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

  const shouldShowMasterSanctum = Number(profile?.member_level) === 10 && masterExamRequestStatus === 'pending';
  if (shouldShowMasterSanctum) {
    return <MasterExamPendingSanctum fullScreen />;
  }

  return (
    <div
      key={entranceKey}
      className="min-h-screen max-h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-[#050505] px-4 pt-4 pb-20 font-sans animate-in fade-in duration-1000 ease-out zoom-in-95 fill-mode-forwards"
    >
      <div className="mx-auto flex min-h-[calc(100dvh-6.5rem)] w-full max-w-[420px] flex-col gap-10">
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
        />

        <div className="space-y-10">
          <AthleteStatusBoard
            targetUserId={profile.id}
            ledgerRefreshKey={ledgerRefreshKey}
          />
        </div>

        <div className="mt-auto flex justify-center pb-6 pt-2">
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
