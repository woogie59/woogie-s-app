import React, { useState } from 'react';
import MemberGrowthLedger from './MemberGrowthLedger';
import { getAthleteLevelDescription } from './athleteLevelDescriptions';
import TitleArchiveModal from './TitleArchiveModal';

export default function AthleteStatusBoard({
  targetUserId,
  ownedTitles,
  loadingData = false,
  ledgerRefreshKey = 0,
  level = 1,
  isMaster = false,
}) {
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const statusDescription = getAthleteLevelDescription(level, { isMaster });

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">[ 획득한 칭호 - 아카이브 ]</p>
        <button
          type="button"
          onClick={() => setIsTitleModalOpen(true)}
          className="mt-4 w-full rounded-xl border border-white/15 bg-black/50 py-3 text-xs font-semibold tracking-[0.16em] text-zinc-200 transition hover:border-white/30 hover:bg-black/70"
        >
          [ 칭호 보관함 열기 ]
        </button>
      </section>

      <p className="mb-4 mt-6 text-sm font-semibold text-zinc-400">나의 운동 상태</p>
      <p className="mb-6 text-sm leading-relaxed text-zinc-300">{statusDescription}</p>

      <section>
        <p className="mb-3 text-center text-[11px] font-medium tracking-[0.2em] text-white/40">성장 기록</p>
        <MemberGrowthLedger targetUserId={targetUserId} refreshKey={ledgerRefreshKey} />
      </section>

      <TitleArchiveModal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        memberId={targetUserId}
        acquiredTitles={ownedTitles}
      />
    </>
  );
}
