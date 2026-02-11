import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

const CinematicIntro = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => onComplete(), 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 1.5, duration: 1 }}
      onAnimationComplete={onComplete}
    >
      <motion.h1
        className="text-2xl md:text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 tracking-widest text-center px-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut", repeat: 1, repeatType: "reverse" }}
      >
        THE COACH<br /><span className="text-sm md:text-lg text-zinc-500 font-sans tracking-[0.5em]">PROFESSIONAL</span>
      </motion.h1>
    </motion.div>
  );
};

export default CinematicIntro;
