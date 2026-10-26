import React, { useLayoutEffect, useState } from 'react';
import { DesignRefinementContext } from './designRefinement';

const styles = `
[data-design-refinement] .font-serif { font-family: inherit; }
[data-design-refinement] [class*="text-[8px]"],
[data-design-refinement] [class*="text-[9px]"],
[data-design-refinement] [class*="text-[10px]"],
[data-design-refinement] [class*="text-[11px]"] { font-size:12px; line-height:1.5; }
[data-design-refinement] .text-gray-300:not(:disabled),
[data-design-refinement] .text-gray-400:not(:disabled),
[data-design-refinement] .text-gray-500:not(:disabled) { color:#5f6875; }
[data-design-refinement] .font-light { font-weight:400; }
[data-design-refinement] [class*="bg-gradient-to-"] { background-image:none; background-color:#064e3b; }
[data-design-refinement] .bg-emerald-600,
[data-design-refinement] [class*="bg-[#0B3B24]"],
[data-design-refinement] [class*="bg-[#059669]"] { background-color:#064e3b; }
[data-design-refinement] [class*="border-[#0B3B24]"] { border-color:#064e3b; }
[data-design-refinement] .text-emerald-600 { color:#064e3b; }
[data-design-refinement] button:active { transform:scale(.98); }
[data-design-refinement] button:focus-visible { outline:2px solid #064e3b; outline-offset:3px; }
[data-design-refinement] button:disabled { cursor:not-allowed; }
[data-design-refinement] .refinement-week { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:4px; overflow:visible; margin:0; padding-left:0; padding-right:0; touch-action:pan-y; }
[data-design-refinement] .refinement-week > button { min-width:0; padding-left:2px; padding-right:2px; }
[data-design-refinement] .refinement-sheet-backdrop { align-items:flex-end; padding:0; }
[data-design-refinement] .refinement-sheet { max-width:480px; border-radius:24px 24px 0 0; padding:24px 24px max(24px,env(safe-area-inset-bottom)); background:white; }
@media (prefers-reduced-motion:reduce) { [data-design-refinement] * { animation:none !important; transition:none !important; } }
`;

export function DesignRefinementProvider({ children }) {
  const [enabled, setEnabled] = useState(false);
  useLayoutEffect(() => {
    if (!enabled) return;
    document.getElementById('root')?.setAttribute('data-design-refinement', 'member');
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute('content');
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    return () => { document.getElementById('root')?.removeAttribute('data-design-refinement'); if (meta && original) meta.setAttribute('content', original); };
  }, [enabled]);
  return <DesignRefinementContext.Provider value={{ enabled, setEnabled }}>
    <>
      {enabled && <style>{styles}</style>}
      {children}
    </>
  </DesignRefinementContext.Provider>;
}

export function MemberHomeSkeleton() {
  return <div role="status" aria-label="홈을 불러오는 중" className="min-h-[100dvh] bg-gray-50 px-5 pt-10 space-y-6">
    <span className="sr-only">홈을 불러오는 중입니다.</span>
    <div className="mx-auto h-8 w-32 rounded-xl bg-gray-200 animate-pulse" />
    <div className="h-64 rounded-3xl bg-gray-200 animate-pulse" />
    <div className="grid grid-cols-2 gap-4"><div className="h-28 rounded-2xl bg-gray-200 animate-pulse" /><div className="h-28 rounded-2xl bg-gray-200 animate-pulse" /></div>
    <div className="h-24 rounded-2xl bg-gray-200 animate-pulse" />
  </div>;
}
