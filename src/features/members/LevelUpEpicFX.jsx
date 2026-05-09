import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';

/**
 * Full-viewport ephemeral "LEVEL UP" — no static DOM text; does not block the level readout after fade-out.
 */
export default function LevelUpEpicFX({ triggerKey }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!triggerKey || triggerKey <= 0) return;
    setOpen(true);
    const hide = window.setTimeout(() => setOpen(false), 3200);
    return () => window.clearTimeout(hide);
  }, [triggerKey]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <Motion.div
          key={triggerKey}
          role="presentation"
          aria-hidden
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <Motion.div
            className="pointer-events-none flex flex-col items-center justify-center px-8"
            initial={{ opacity: 0, scale: 0.92, filter: 'blur(10px)' }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.92, 1, 1, 0.98],
              filter: ['blur(10px)', 'blur(0px)', 'blur(0px)', 'blur(6px)'],
            }}
            transition={{
              duration: 3,
              times: [0, 0.08, 0.67, 1],
              ease: 'easeInOut',
            }}
          >
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-14 py-10 shadow-[0_0_80px_rgba(147,51,234,0.12)] backdrop-blur-xl">
              <p className="text-center font-sans text-[11px] font-semibold uppercase tracking-[0.55em] text-platinum/90">
                LEVEL UP
              </p>
            </div>
          </Motion.div>
        </Motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
