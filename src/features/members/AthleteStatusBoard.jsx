import React from 'react';
import { useState } from 'react';
import MemberGrowthLedger from './MemberGrowthLedger';

export default function AthleteStatusBoard({
  targetUserId,
  ledgerRefreshKey = 0,
}) {
  const [isGrowthOpen, setIsGrowthOpen] = useState(false);

  return (
    <>
      <section>
        <button
          type="button"
          onClick={() => setIsGrowthOpen((prev) => !prev)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
        >
          {isGrowthOpen ? '성장기록 닫기' : '성장기록 보기'}
        </button>
        {isGrowthOpen ? (
          <div className="mt-3">
            <MemberGrowthLedger targetUserId={targetUserId} refreshKey={ledgerRefreshKey} />
          </div>
        ) : null}
      </section>
    </>
  );
}
