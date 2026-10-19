import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

/** Total choreography must finish before fade-out begins. */
const MIN_VISIBLE_MS = 1650;
/** Fade-out duration — slow, deliberate transition before unmount (matches Framer transition). */
const FADE_OUT_DURATION_S = 0.55;

const WORD = 'LAB DOT'.split('');

/**
 * Silent Luxury splash: white field, deep green dot + LAB DOT.
 * 1) Dot springs in with a soft halo pulse.
 * 2) Wordmark letters rise one by one, tracking eases open.
 * 4) Short hold, then the layer fades out and onComplete fires.
 */
const CinematicIntro = ({ onComplete }) => {
  const [phase, setPhase] = useState('enter'); // 'enter' | 'fadeOut'
  const finishedRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setPhase('fadeOut'), MIN_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (phase !== 'fadeOut') return;
    const ms = Math.round(FADE_OUT_DURATION_S * 1000);
    const id = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onComplete();
    }, ms);
    return () => window.clearTimeout(id);
  }, [phase, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FFFFFF]"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'fadeOut' ? 0 : 1 }}
      transition={{
        duration: phase === 'fadeOut' ? FADE_OUT_DURATION_S : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="flex flex-col items-center justify-center gap-6">
        {/* Dot: spring in + one soft halo pulse */}
        <div className="relative flex items-center justify-center">
          <motion.span
            className="absolute rounded-full bg-[#064e3b]"
            initial={{ opacity: 0.35, scale: 1 }}
            animate={{ opacity: [0.35, 0, 0], scale: [1, 2.6, 2.6] }}
            transition={{ duration: 1.1, delay: 0.15, times: [0, 0.8, 1], ease: 'easeOut' }}
            style={{ width: 24, height: 24 }}
            aria-hidden
          />
          <motion.span
            className="h-6 w-6 rounded-full bg-[#064e3b] shadow-sm"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, mass: 0.9 }}
            aria-hidden
          />
        </div>
        {/* Wordmark: letters rise in sequence */}
        <div className="flex overflow-hidden" aria-label="LAB DOT">
          {WORD.map((ch, i) => (
            <motion.span
              key={i}
              className="font-sans text-lg font-semibold uppercase tracking-[0.38em] text-[#064e3b] leading-none md:text-xl"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.32 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default CinematicIntro;
