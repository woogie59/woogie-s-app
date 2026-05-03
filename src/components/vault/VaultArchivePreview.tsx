import React from 'react';
import { Lock } from 'lucide-react';

type MilestoneItem = {
  id: string;
  display: string;
  caption: string;
  unlocked: boolean;
  metal: 'gold' | 'platinum';
};

const MILESTONES: MilestoneItem[] = [
  {
    id: '100',
    display: '100',
    caption: 'CLUB',
    unlocked: true,
    metal: 'gold',
  },
  {
    id: '50',
    display: '50',
    caption: 'STRONG',
    unlocked: true,
    metal: 'platinum',
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
  onClose?: () => void;
  /** When true, renders the same member UI without fullscreen overlay (for admin mirror). */
  embedded?: boolean;
  className?: string;
};

const MEDAL = 'w-[9.25rem] h-[9.25rem] sm:w-40 sm:h-40';

const VaultArchivePreview: React.FC<VaultArchivePreviewProps> = ({ onClose, embedded = false, className = '' }) => {
  const shell = embedded
    ? `relative w-full min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] text-white antialiased ${className}`
    : `fixed inset-0 z-[100] w-full h-full min-h-[100dvh] bg-[#0a0a0a] overflow-hidden text-white antialiased animate-in fade-in zoom-in-95 duration-500 ease-out ${className}`;

  const innerMinH = embedded ? 'min-h-[300px]' : 'min-h-[100dvh]';
  const topPad = embedded ? 'pt-6' : 'pt-[max(3.25rem,calc(env(safe-area-inset-top)+2.5rem))]';

  return (
    <div
      className={shell}
      role={embedded ? undefined : 'dialog'}
      aria-modal={embedded ? undefined : 'true'}
      aria-label="프라이빗 아카이브"
    >
      {!embedded && onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="fixed right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[101] rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
          aria-label="프라이빗 아카이브 닫기"
        >
          닫기
        </button>
      ) : null}

      <div
        className={`flex ${innerMinH} w-full flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-black ${embedded ? '' : 'pb-safe'}`}
      >
        <div className={`flex min-h-0 flex-1 w-full items-center justify-center px-4 ${topPad} pb-10`}>
          <div className="flex w-full max-w-full justify-center overflow-x-auto scrollbar-hide snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
            <div className="flex shrink-0 items-center gap-7 px-3 py-2">
              {MILESTONES.map((m) => {
                if (m.unlocked) {
                  const isGold = m.metal === 'gold';
                  const medalFrame = isGold
                    ? 'bg-gradient-to-br from-[#bf953f] via-[#fcf6ba] to-[#b38728] shadow-[0_0_48px_rgba(191,149,63,0.45)] border border-[#fbf5b7]/50'
                    : 'bg-gradient-to-br from-[#94a3b8] via-[#f1f5f9] to-[#64748b] shadow-[0_0_44px_rgba(226,232,240,0.35)] border border-white/45';
                  const glow = isGold
                    ? 'bg-[radial-gradient(circle,_rgba(252,246,186,0.55)_0%,_rgba(191,149,63,0.2)_45%,_transparent_70%)]'
                    : 'bg-[radial-gradient(circle,_rgba(241,245,249,0.5)_0%,_rgba(148,163,184,0.22)_45%,_transparent_70%)]';
                  return (
                    <div
                      key={m.id}
                      className="snap-center shrink-0 flex flex-col items-center w-[10.5rem]"
                      aria-label={`달성: ${m.display} ${m.caption}`}
                    >
                      <div className="relative flex items-center justify-center">
                        <div
                          className={`pointer-events-none absolute ${MEDAL} scale-110 rounded-full blur-2xl opacity-90 ${glow}`}
                          aria-hidden
                        />
                        <div
                          className={`relative ${MEDAL} rounded-full p-[3px] flex items-center justify-center ${medalFrame}`}
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
                    </div>
                  );
                }
                return (
                  <div
                    key={m.id}
                    className="snap-center shrink-0 flex flex-col items-center w-[10.5rem] opacity-[0.42]"
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultArchivePreview;

