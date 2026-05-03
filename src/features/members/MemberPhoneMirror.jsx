import React from 'react';

/**
 * iPhone 15 Pro–style device chrome for admin member-view simulation.
 */
export default function MemberPhoneMirror({ children, label = 'Live Member Mirror' }) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">{label}</p>
      <div
        className="relative mx-auto w-full max-w-[340px] rounded-[2.65rem] p-[3px] shadow-[0_32px_80px_-12px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.35)]"
        style={{
          background: 'linear-gradient(160deg, #52525b 0%, #18181b 22%, #27272a 50%, #0a0a0a 100%)',
        }}
      >
        <div className="rounded-[2.45rem] bg-zinc-950 p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="relative overflow-hidden rounded-[2.15rem] bg-black ring-1 ring-white/10">
            {/* Dynamic Island */}
            <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-[28px] w-[120px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
            {/* Side button hint */}
            <div className="pointer-events-none absolute -right-0.5 top-[22%] z-0 h-14 w-[3px] rounded-l-sm bg-zinc-700/90" />
            <div className="pointer-events-none absolute -left-0.5 top-[18%] z-0 h-10 w-[3px] rounded-r-sm bg-zinc-700/90" />
            <div className="pointer-events-none absolute -left-0.5 top-[32%] z-0 h-16 w-[3px] rounded-r-sm bg-zinc-700/90" />

            <div className="max-h-[min(72vh,640px)] overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin]">
              <div className="min-h-full bg-[#0a0a0a] px-3 pb-10 pt-11">{children}</div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 max-w-[280px] text-center text-[10px] leading-relaxed text-neutral-400">
        미리보기는 저장 전 가상 상태입니다. DB 반영은 왼쪽 패널에서 저장하세요.
      </p>
    </div>
  );
}
