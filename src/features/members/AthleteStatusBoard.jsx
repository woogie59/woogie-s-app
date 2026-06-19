import React, { useState } from 'react';
import MemberGrowthLedger from './MemberGrowthLedger';
import { AthleteSectionNewBadge } from '../../utils/athleteBoardNotifications';

export default function AthleteStatusBoard({
  targetUserId,
  ledgerRefreshKey = 0,
  hasGrowthNew = false,
  onGrowthOpened,
}) {
  const [isGrowthOpen, setIsGrowthOpen] = useState(false);

  const handleToggle = () => {
    const next = !isGrowthOpen;
    setIsGrowthOpen(next);
    if (next && onGrowthOpened) {
      onGrowthOpened();
    }
  };

  return (
    <section>
      <button
        type="button"
        onClick={handleToggle}
        className={`relative w-full rounded-xl border px-3 py-3.5 text-sm font-semibold transition ${
          hasGrowthNew && !isGrowthOpen
            ? 'border-emerald-400/60 bg-emerald-950/30 text-emerald-50 ring-2 ring-emerald-400/30 shadow-[0_0_16px_rgba(16,185,129,0.15)]'
            : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:text-white'
        }`}
      >
        <span className="flex items-center justify-center gap-2">
          <span>{isGrowthOpen ? '성장기록 닫기' : '성장기록 보기'}</span>
          {hasGrowthNew && !isGrowthOpen ? (
            <>
              <AthleteSectionNewBadge />
              <span className="text-[10px] font-normal text-emerald-300/80">레벨·코멘트 업데이트</span>
            </>
          ) : null}
        </span>
      </button>
      {isGrowthOpen ? (
        <div className="mt-3">
          <MemberGrowthLedger targetUserId={targetUserId} refreshKey={ledgerRefreshKey} />
        </div>
      ) : null}
    </section>
  );
}
