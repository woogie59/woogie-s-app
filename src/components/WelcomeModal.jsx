import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WelcomeModal = ({ isOpen, userName, onStart }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={onStart}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 p-8 text-center"
          >
            <h2 className="text-2xl font-serif text-white mb-2">
              반갑습니다, {userName || '회원'}님
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">
              새로운 변화의 시작을 환영합니다. 당신의 건강한 라이프스타일을 위해 최선을 다하겠습니다.
            </p>
            <button
              onClick={onStart}
              className="w-full py-3.5 px-6 rounded-xl font-medium text-white bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 active:scale-[0.98] transition-all shadow-lg shadow-amber-900/20"
            >
              시작하기
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeModal;
