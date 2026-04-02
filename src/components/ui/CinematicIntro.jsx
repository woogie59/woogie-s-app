import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { LabDotBrand } from './LabDotBrand';

/** Minimum time the splash stays visible (logo readable) before fade-out begins. */
const MIN_VISIBLE_MS = 500;
/** Fade-out duration — slow, deliberate transition before unmount (matches Framer transition). */
const FADE_OUT_DURATION_S = 0.55;

/**
 * Silent Luxury splash: white field, deep green dot + LAB DOT.
 * 1) Inner mark fades in.
 * 2) At least MIN_VISIBLE_MS on screen.
 * 3) Outer layer fades out smoothly, then onComplete (App hides splash).
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >
        <LabDotBrand variant="splash" />
      </motion.div>
    </motion.div>
  );
};

export default CinematicIntro;
