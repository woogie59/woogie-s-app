import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { LabDotBrand } from './LabDotBrand';

/**
 * Silent Luxury splash: white field, deep green dot + LAB DOT only.
 * Total 0.8s — reveal then crisp fade-out; login fades in behind.
 */
const CinematicIntro = ({ onComplete }) => {
  useEffect(() => {
    const t = setTimeout(() => onComplete(), 800);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FFFFFF]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 0.5, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      >
        <LabDotBrand variant="splash" />
      </motion.div>
    </motion.div>
  );
};

export default CinematicIntro;
