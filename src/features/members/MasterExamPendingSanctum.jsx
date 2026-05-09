import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Cinematic full-bleed "athlete sanctum" for Lv.10 + master exam pending.
 * No CTAs, no copy blocks — only typographic authority.
 */
export default function MasterExamPendingSanctum({ fullScreen = false }) {
  const inner = (
    <>
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4">
        <p
          className="whitespace-nowrap text-center text-[18vw] font-black leading-none tracking-[0.8em] bg-gradient-to-b from-purple-400 via-purple-700 to-black bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(168,85,247,0.7)]"
          aria-hidden
        >
          M A S T E R
        </p>
        <div className="mt-8 text-xs font-semibold tracking-[0.6em] text-purple-400">
          U N D E R&nbsp;&nbsp;&nbsp;J U D G E M E N T
        </div>
      </div>
    </>
  );

  const shell = (
    <div
      className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center overflow-hidden font-sans text-white"
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
