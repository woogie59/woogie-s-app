import React from 'react';
import MemberGrowthLedger from './MemberGrowthLedger';

export default function AthleteStatusBoard({
  targetUserId,
  ledgerRefreshKey = 0,
}) {
  return (
    <>
      <section>
        <p className="mb-3 text-center text-[11px] font-medium tracking-[0.2em] text-white/40">성장 기록</p>
        <MemberGrowthLedger targetUserId={targetUserId} refreshKey={ledgerRefreshKey} />
      </section>
    </>
  );
}
