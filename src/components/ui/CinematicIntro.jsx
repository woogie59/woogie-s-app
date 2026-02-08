import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CinematicIntro = ({ show, onComplete }) => {
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => onComplete(), 3500)
    return () => clearTimeout(timer)
  }, [show, onComplete])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 2.0, duration: 1 }}
          onAnimationComplete={onComplete}
        >
          <motion.h1
            className="px-4 text-center text-2xl font-serif tracking-widest text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text md:text-4xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.5,
              ease: 'easeInOut',
              repeat: 1,
              repeatType: 'reverse',
            }}
          >
            Change Your Body,
            <br />
            Change Your Life.
          </motion.h1>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default CinematicIntro

