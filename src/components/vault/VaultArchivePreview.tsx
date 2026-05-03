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

type MilestoneItem = {
  id: string;
  display: string;
  caption: string;
  unlocked: boolean;
  metal: 'gold' | 'platinum';
  blurb?: string;
};

const MILESTONES: MilestoneItem[] = [
  {
    id: '100',
    display: '100',
    caption: 'CLUB',
    unlocked: true,
    metal: 'gold',
    blurb: '누적 출석 100회 달성',
  },
  {
    id: '50',
    display: '50',
    caption: 'STRONG',
    unlocked: true,
    metal: 'platinum',
    blurb: '연속 50 세션',
  },
  {
    id: '200',
    display: '200',
    caption: 'LEGACY',
    unlocked: false,
    metal: 'gold',
  },
  {
    id: '365',
    display: '365',
    caption: 'VAULT',
    unlocked: false,
    metal: 'gold',
  },
];

const VaultArchivePreview: React.FC = () => {
  const heatmapCells = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => ({
      id: i,
      filled: isFilledCell(i),
    }));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-black text-white antialiased animate-[fadeInScale_0.85s_cubic-bezier(0.16,1,0.3,1)_both]">
      <div className="mx-auto max-w-md px-5 py-8 pb-safe flex flex-col gap-10">
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-6">12주 출석 히트맵</h2>
          <div
            className="grid grid-cols-7 gap-1.5 [--brand-color:#059669]"
            role="img"
            aria-label="최근 12주 출석 히트맵 미리보기"
          >
            {heatmapCells.map(({ id, filled }) => (
              <div
                key={id}
                className={`w-3 h-3 shrink-0 rounded-full mx-auto ${
                  filled
                    ? 'bg-[color:var(--brand-color)] shadow-[0_0_8px_var(--brand-color)]'
                    : 'bg-gray-800/50'
                }`}
                aria-hidden
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500 font-light">최근 12주 · 한 칸 = 하루 (미리보기 데이터)</p>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-6">마일스톤</h2>
          <div className="flex overflow-x-auto gap-6 pb-3 -mx-1 px-1 scrollbar-hide snap-x snap-mandatory">
            {MILESTONES.map((m) => {
              if (m.unlocked) {
                const isGold = m.metal === 'gold';
                const shell = isGold
                  ? 'bg-gradient-to-br from-[#bf953f] via-[#fcf6ba] to-[#b38728] shadow-[0_0_40px_rgba(191,149,63,0.3)] border border-[#fbf5b7]/50'
                  : 'bg-gradient-to-br from-[#94a3b8] via-[#f1f5f9] to-[#64748b] shadow-[0_0_36px_rgba(148,163,184,0.35)] border border-white/40';
                return (
                  <div
                    key={m.id}
                    className="snap-center shrink-0 flex flex-col items-center gap-2 w-[8.5rem]"
                    aria-label={`달성: ${m.display} ${m.caption}`}
                  >
                    <div
                      className={`w-32 h-32 rounded-full p-[3px] flex items-center justify-center ${shell}`}
                    >
                      <div className="w-full h-full rounded-full border-[4px] border-black/20 flex flex-col items-center justify-center bg-black/10 shadow-[inset_0_2px_12px_rgba(0,0,0,0.35)]">
                        <span className="text-2xl font-black tabular-nums text-[#0a0a0a] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] leading-none">
                          {m.display}
                        </span>
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#0a0a0a]/85 mt-1">
                          {m.caption}
                        </span>
                      </div>
                    </div>
                    {m.blurb ? (
                      <p className="text-[11px] text-center text-gray-400 leading-snug px-1">{m.blurb}</p>
                    ) : null}
                  </div>
                );
              }
              return (
                <div
                  key={m.id}
                  className="snap-center shrink-0 flex flex-col items-center gap-2 w-[8.5rem] opacity-[0.42]"
                  aria-label={`잠금: ${m.display} ${m.caption}`}
                >
                  <div className="w-32 h-32 rounded-full p-[3px] bg-gradient-to-br from-gray-800 via-gray-900 to-black border border-gray-700/80 shadow-[inset_0_0_24px_rgba(0,0,0,0.85)] flex items-center justify-center">
                    <div className="w-full h-full rounded-full border-[4px] border-black/40 flex flex-col items-center justify-center relative">
                      <Lock className="text-gray-600 mb-0.5" size={22} strokeWidth={1.5} aria-hidden />
                      <span className="text-lg font-black tabular-nums text-gray-600 leading-none">{m.display}</span>
                      <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-gray-600 mt-0.5">
                        {m.caption}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-center text-gray-600 leading-snug">조건 미충족</p>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-6">정의 수치</h2>
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
