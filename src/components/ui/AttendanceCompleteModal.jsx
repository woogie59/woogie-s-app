import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Post–QR scan: clinical / minimalist confirmation with bold session counts.
 */
const AttendanceCompleteModal = ({ open, currentCount, totalCount, onConfirm }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="attendance-complete-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[220] flex items-center justify-center p-6 bg-slate-900/35"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full max-w-[min(22rem,100%)] rounded-2xl border border-[#064e3b]/15 bg-white px-8 py-9 shadow-xl shadow-slate-900/10"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-[#064e3b]/70 text-center mb-3">
              Session
            </p>
            <h2 id="attendance-complete-title" className="text-center text-lg font-semibold tracking-tight text-slate-900 mb-8">
              출석 완료!
            </h2>

            <p className="text-center text-[17px] leading-snug text-slate-800 mb-10">
              <span className="text-4xl font-bold tabular-nums text-[#064e3b]">{currentCount != null ? currentCount : '—'}</span>
              <span className="text-base font-semibold text-slate-600 ml-1">회차</span>
              <span className="text-slate-300 mx-3 font-light">/</span>
              <span className="text-slate-600">총</span>{' '}
              <span className="text-4xl font-bold tabular-nums text-slate-900">{totalCount != null ? totalCount : '—'}</span>
              <span className="text-base font-semibold text-slate-600 ml-0.5">회</span>
            </p>

            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-xl bg-[#064e3b] py-3.5 text-[15px] font-semibold text-white shadow-md shadow-[#064e3b]/20 transition hover:bg-[#053d2f] active:scale-[0.99]"
            >
              확인
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AttendanceCompleteModal;
