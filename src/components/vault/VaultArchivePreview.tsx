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

export type VaultArchivePreviewProps = {
  onClose: () => void;
};

const MEDAL = 'w-[9.25rem] h-[9.25rem] sm:w-40 sm:h-40';

const VaultArchivePreview: React.FC<VaultArchivePreviewProps> = ({ onClose }) => {
  const heatmapCells = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => ({
      id: i,
      filled: isFilledCell(i),
    }));
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] w-full h-full min-h-[100dvh] bg-[#0a0a0a] overflow-y-auto text-white antialiased animate-in fade-in zoom-in-95 duration-500 ease-out"
      role="dialog"
      aria-modal="true"
      aria-label="프라이빗 아카이브"
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[101] rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
        aria-label="프라이빗 아카이브 닫기"
      >
        닫기
      </button>
      <div className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-black pt-[max(3.25rem,calc(env(safe-area-inset-top)+2.75rem))] pb-safe">
        <div className="mx-auto max-w-md px-5 py-8 flex flex-col gap-12">
          {/* Hero: Milestones */}
          <section className="text-center">
            <h2 className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-7">Milestones</h2>
            <div className="flex overflow-x-auto gap-7 pb-4 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory justify-start sm:justify-center">
              {MILESTONES.map((m) => {
                if (m.unlocked) {
                  const isGold = m.metal === 'gold';
                  const shell = isGold
                    ? 'bg-gradient-to-br from-[#bf953f] via-[#fcf6ba] to-[#b38728] shadow-[0_0_48px_rgba(191,149,63,0.45)] border border-[#fbf5b7]/50'
                    : 'bg-gradient-to-br from-[#94a3b8] via-[#f1f5f9] to-[#64748b] shadow-[0_0_44px_rgba(226,232,240,0.35)] border border-white/45';
                  const glow = isGold
                    ? 'bg-[radial-gradient(circle,_rgba(252,246,186,0.55)_0%,_rgba(191,149,63,0.2)_45%,_transparent_70%)]'
                    : 'bg-[radial-gradient(circle,_rgba(241,245,249,0.5)_0%,_rgba(148,163,184,0.22)_45%,_transparent_70%)]';
                  return (
                    <div
                      key={m.id}
                      className="snap-center shrink-0 flex flex-col items-center gap-3 w-[10.5rem]"
                      aria-label={`달성: ${m.display} ${m.caption}`}
                    >
                      <div className="relative flex items-center justify-center">
                        <div
                          className={`pointer-events-none absolute ${MEDAL} scale-110 rounded-full blur-2xl opacity-90 ${glow}`}
                          aria-hidden
                        />
                        <div
                          className={`relative ${MEDAL} rounded-full p-[3px] flex items-center justify-center ${shell}`}
                        >
                          <div className="w-full h-full rounded-full border-[4px] border-black/20 flex flex-col items-center justify-center bg-black/10 shadow-[inset_0_2px_14px_rgba(0,0,0,0.38)]">
                            <span className="text-3xl font-black tabular-nums text-[#0a0a0a] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] leading-none">
                              {m.display}
                            </span>
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#0a0a0a]/85 mt-1.5">
                              {m.caption}
                            </span>
                          </div>
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
                    className="snap-center shrink-0 flex flex-col items-center gap-3 w-[10.5rem] opacity-[0.42]"
                    aria-label={`잠금: ${m.display} ${m.caption}`}
                  >
                    <div
                      className={`${MEDAL} rounded-full p-[3px] bg-gradient-to-br from-gray-800 via-gray-900 to-black border border-gray-700/80 shadow-[inset_0_0_28px_rgba(0,0,0,0.88)] flex items-center justify-center`}
                    >
                      <div className="w-full h-full rounded-full border-[4px] border-black/40 flex flex-col items-center justify-center relative">
                        <Lock className="text-gray-600 mb-0.5" size={24} strokeWidth={1.5} aria-hidden />
                        <span className="text-xl font-black tabular-nums text-gray-600 leading-none">{m.display}</span>
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

          {/* Middle: Consistency — compact LED heatmap */}
          <section>
            <h2 className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-4">Consistency</h2>
            <div className="inline-flex w-full max-w-[200px] mx-auto flex-col items-stretch rounded-xl border border-white/[0.08] bg-black/35 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div
                className="grid grid-cols-7 gap-1 justify-items-center [--brand-color:#059669]"
                role="img"
                aria-label="최근 12주 출석 히트맵 미리보기"
              >
                {heatmapCells.map(({ id, filled }) => (
                  <div
                    key={id}
                    className={`w-2 h-2 shrink-0 rounded-full ${
                      filled
                        ? 'bg-[color:var(--brand-color)] shadow-[0_0_6px_var(--brand-color)]'
                        : 'bg-gray-800/50'
                    }`}
                    aria-hidden
                  />
                ))}
              </div>
              <p className="mt-2.5 text-[10px] text-gray-600 font-light tracking-wide text-center leading-tight">
                12주 · 1칸 = 1일
              </p>
            </div>
          </section>

          {/* Bottom: My records */}
          <section>
            <h2 className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-6">My records</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-9">
              <div>
                <p className="text-sm text-gray-500">누적 출석</p>
                <p className="text-3xl font-black text-white tracking-tight tabular-nums mt-1.5">42회</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">현재 스트릭</p>
                <p className="text-3xl font-black text-white tracking-tight tabular-nums mt-1.5">7주</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">베스트 스트릭</p>
                <p className="text-3xl font-black text-white tracking-tight tabular-nums mt-1.5">12주</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">이번 달</p>
                <p className="text-3xl font-black text-white tracking-tight tabular-nums mt-1.5">9회</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default VaultArchivePreview;
