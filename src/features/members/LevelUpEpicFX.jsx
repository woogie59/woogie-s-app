import React from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';

/**
 * Short "premium" level-up burst for the member mirror (contained, no full-app takeover).
 */
export default function LevelUpEpicFX({ triggerKey }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[inherit]">
      <AnimatePresence mode="sync">
        {triggerKey > 0 ? (
          <Motion.div
            key={triggerKey}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Motion.div
              className="absolute inset-[-40%] bg-[conic-gradient(from_210deg,rgba(34,197,94,0)_0deg,rgba(52,211,153,0.35)_90deg,rgba(16,185,129,0)_280deg)] opacity-90"
              initial={{ rotate: -25, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 40, scale: 1.25, opacity: 0.85 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
            <Motion.div
              className="absolute h-[140%] w-[140%] rounded-full border-2 border-emerald-300/50 shadow-[0_0_60px_rgba(52,211,153,0.55)]"
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: 1.35, opacity: 0 }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
            />
            <Motion.div
              className="absolute h-[90%] w-[90%] rounded-full border border-white/25"
              initial={{ scale: 0.35, opacity: 0.7 }}
              animate={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.05 }}
            />
            <Motion.div
              className="relative text-center"
              initial={{ scale: 0.5, y: 24, opacity: 0, filter: 'blur(12px)' }}
              animate={{ scale: 1, y: 0, opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-emerald-200/90">Level Up</p>
              <p className="mt-1 text-2xl font-black tracking-tight text-white drop-shadow-[0_0_24px_rgba(52,211,153,0.9)]">
                성장 기록됨
              </p>
            </Motion.div>
          </Motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
