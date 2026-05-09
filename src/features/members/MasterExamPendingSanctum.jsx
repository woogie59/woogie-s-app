import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Cinematic full-bleed "athlete sanctum" for Lv.10 + master exam pending.
 * No CTAs, no copy blocks — only typographic authority.
 */
export default function MasterExamPendingSanctum({ fullScreen = false }) {
  const inner = (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_42%,rgba(147,51,234,0.16)_0%,rgba(5,5,5,0)_52%,#050505_100%)]"
        aria-hidden
      />
      <div className="relative z-10 flex w-full max-w-[100vw] flex-col items-center justify-center gap-24 px-6 py-32">
        <p
          className="max-w-[100vw] text-center font-black leading-[0.92] tracking-[0.8em] bg-gradient-to-b from-purple-500 via-purple-700 to-black bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(147,51,234,0.6)] text-[clamp(2.75rem,16vw,16rem)]"
          aria-hidden
        >
          M A S T E R
        </p>
        <p className="max-w-[95vw] text-center text-xs font-semibold uppercase tracking-[0.6em] text-purple-400">
          U N D E R&nbsp;&nbsp;&nbsp;J U D G E M E N T
        </p>
      </div>
    </>
  );

  const shell = (
    <div
      className="relative flex min-h-full w-full items-center justify-center overflow-hidden bg-[#050505] font-sans text-white"
      role="status"
      aria-live="polite"
      aria-label="마스터 심사 진행 중"
    >
      {inner}
    </div>
  );

  if (fullScreen && typeof document !== 'undefined') {
    return createPortal(
      <div className="fixed inset-0 z-[220] min-h-[100dvh] w-full bg-[#050505]">{shell}</div>,
      document.body
    );
  }

  return <div className="flex min-h-[min(100dvh,72vh)] w-full bg-[#050505]">{shell}</div>;
}
