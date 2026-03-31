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
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/20 backdrop-blur-md"
          onClick={onStart}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white/95 border border-emerald-600/20 rounded-2xl shadow-xl shadow-gray-900/10 p-8 text-center backdrop-blur-xl"
          >
            <h2 className="text-2xl font-serif text-slate-900 mb-2">
              환영합니다, {userName || '회원'}님
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              LAB DOT와 함께 프리미엄 퍼포먼스 루틴을 시작하세요.
            </p>
            <button
              onClick={onStart}
              className="w-full py-3.5 px-6 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] transition-all shadow-lg shadow-emerald-900/20 border border-emerald-600/30"
            >
              나의 라이프스타일 관리하기
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeModal;
