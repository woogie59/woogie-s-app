import React, { useMemo } from 'react';
import { Lock } from 'lucide-react';

const WEEKS = 12;
const DAYS_PER_WEEK = 7;
const TOTAL_DAYS = WEEKS * DAYS_PER_WEEK;

/** Deterministic “random” fill for stable preview pixels (no flicker on re-render). */
function isFilledCell(index: number): boolean {
  const x = ((index * 17 + 23) * 7919) % 1000;
  return x < 320;
}

const VaultArchivePreview: React.FC = () => {
  const heatmapCells = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => ({
      id: i,
      filled: isFilledCell(i),
    }));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white antialiased">
      <div className="mx-auto max-w-md px-5 py-8 pb-safe flex flex-col gap-10">
        {/* Task 2: Consistency Heatmap */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-1">Consistency</p>
          <h2 className="text-lg font-semibold tracking-tight text-white/95 mb-4">12주 출석 히트맵</h2>
          <div className="grid grid-cols-7 gap-1">
            {heatmapCells.map(({ id, filled }) => (
              <div
                key={id}
                className={`aspect-square w-full max-w-[14px] mx-auto rounded-sm ${
                  filled ? 'bg-[#0B3B24] shadow-[0_0_8px_rgba(11,59,36,0.45)]' : 'bg-gray-800'
                }`}
                aria-hidden
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500 font-light">최근 12주 · 한 칸 = 하루 (미리보기 데이터)</p>
        </section>

        {/* Task 3: Milestone Showcase */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-1">Milestones</p>
          <h2 className="text-lg font-semibold tracking-tight text-white/95 mb-4">마일스톤</h2>
          <div className="flex overflow-x-auto gap-4 pb-2 -mx-1 px-1 scrollbar-hide snap-x snap-mandatory">
            <div
              className="snap-start shrink-0 w-[11.5rem] rounded-2xl bg-gray-900 border border-white/10 px-4 py-5 shadow-[0_0_24px_rgba(6,78,59,0.25),0_8px_32px_rgba(0,0,0,0.5)]"
              aria-label="Unlocked milestone"
            >
              <p className="text-[10px] uppercase tracking-widest text-emerald-500/90 font-medium mb-2">Unlocked</p>
              <p className="text-xl font-black tracking-tight text-white">100 CLUB</p>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">누적 출석 100회 달성</p>
            </div>
            <div
              className="snap-start shrink-0 w-[11.5rem] rounded-2xl bg-gray-900 border border-white/10 px-4 py-5 shadow-[0_0_20px_rgba(255,255,255,0.06),0_8px_28px_rgba(0,0,0,0.45)]"
              aria-label="Unlocked milestone"
            >
              <p className="text-[10px] uppercase tracking-widest text-emerald-500/90 font-medium mb-2">Unlocked</p>
              <p className="text-xl font-black tracking-tight text-white">50 STRONG</p>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">연속 50 세션</p>
            </div>
            <div
              className="snap-start shrink-0 w-[11.5rem] rounded-2xl bg-black/50 border border-gray-800 px-4 py-5 opacity-40 flex flex-col justify-between min-h-[7.5rem]"
              aria-label="Locked milestone"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">Locked</p>
                <Lock className="text-gray-500 shrink-0" size={16} strokeWidth={1.5} aria-hidden />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-gray-500">200 LEGACY</p>
                <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">조건 미충족</p>
              </div>
            </div>
            <div
              className="snap-start shrink-0 w-[11.5rem] rounded-2xl bg-black/50 border border-gray-800 px-4 py-5 opacity-40 flex flex-col justify-between min-h-[7.5rem]"
              aria-label="Locked milestone"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">Locked</p>
                <Lock className="text-gray-500 shrink-0" size={16} strokeWidth={1.5} aria-hidden />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-gray-500">365 VAULT</p>
                <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">조건 미충족</p>
              </div>
            </div>
          </div>
        </section>

        {/* Task 4: Definition Stats */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-1">The Vault</p>
          <h2 className="text-lg font-semibold tracking-tight text-white/95 mb-5">정의 수치</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8">
            <div>
              <p className="text-sm text-gray-500">누적 출석</p>
              <p className="text-3xl font-black text-white tracking-tight tabular-nums mt-1">42회</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">현재 스트릭</p>
              <p className="text-3xl font-black text-white tracking-tight tabular-nums mt-1">7주</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">베스트 스트릭</p>
              <p className="text-3xl font-black text-white tracking-tight tabular-nums mt-1">12주</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">이번 달</p>
              <p className="text-3xl font-black text-white tracking-tight tabular-nums mt-1">9회</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default VaultArchivePreview;
