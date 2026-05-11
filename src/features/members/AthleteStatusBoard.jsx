import React, { useEffect, useState } from 'react';
import MemberGrowthLedger from './MemberGrowthLedger';
import { MemberAcquiredTitlePills, MemberAthleteCoreStatsGrid } from './MemberAthleteMirrorSections';

export default function AthleteStatusBoard({
  targetUserId,
  memberStats,
  ownedTitles,
  loadingData = false,
  ledgerRefreshKey = 0,
}) {
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);

  useEffect(() => {
    if (!isTitleModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isTitleModalOpen]);

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">코어 스탯</p>
        <MemberAthleteCoreStatsGrid stats={memberStats} loading={loadingData} />
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
        <MemberGrowthLedger targetUserId={targetUserId} refreshKey={ledgerRefreshKey} />
      </section>

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
              <MemberAcquiredTitlePills ownedTitles={ownedTitles} loading={loadingData} />
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
    </>
  );
}
