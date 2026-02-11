import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GlobalModal = ({ isOpen, title, message, type = 'alert', onConfirm, onClose, confirmLabel, cancelLabel, loading }) => {
  const isConfirm = type === 'confirm';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full max-w-md bg-zinc-900/95 border border-yellow-600/30 rounded-2xl shadow-2xl shadow-black/50 p-6 backdrop-blur-xl"
          >
            {title && (
              <h3 className="text-lg font-serif text-yellow-500 mb-2">{title}</h3>
            )}
            <p className="text-zinc-300 text-sm leading-relaxed mb-6 whitespace-pre-line">
              {message}
            </p>
            <div className={`flex gap-3 ${isConfirm ? 'justify-end' : 'justify-center'}`}>
              {isConfirm && (
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-medium min-w-[80px]"
                >
                  {cancelLabel ?? '취소'}
                </button>
              )}
              <button
                onClick={() => {
                  if (loading) return;
                  if (isConfirm && onConfirm) onConfirm();
                  else onClose?.();
                }}
                disabled={loading}
                className="px-6 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 active:scale-[0.98] transition-all shadow-lg shadow-amber-900/20 border border-yellow-600/30 disabled:opacity-60 min-w-[80px]"
              >
                {loading ? '처리 중...' : (confirmLabel ?? (isConfirm ? '확인' : '확인'))}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalModal;
