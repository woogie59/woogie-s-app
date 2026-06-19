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
        className={`relative w-full rounded-xl border px-3 py-3 text-sm font-semibold transition ${
          hasGrowthNew && !isGrowthOpen
            ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-100 ring-1 ring-emerald-500/25'
            : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:text-white'
        }`}
      >
        <span className="flex items-center justify-center gap-2">
          {isGrowthOpen ? '성장기록 닫기' : '성장기록 보기'}
          {hasGrowthNew && !isGrowthOpen && <AthleteSectionNewBadge />}
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
