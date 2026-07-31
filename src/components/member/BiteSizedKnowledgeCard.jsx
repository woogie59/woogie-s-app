import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { useBiteSizedKnowledgeRandom } from '../../hooks/useBiteSizedKnowledgeRandom';

const ICON_STROKE = 1.5;

/** Member home dashboard tile — pairs with MY STATUS card (shared min-height). */
export const DASHBOARD_TILE_CLASS =
  'relative h-full min-h-[5.25rem] w-full rounded-2xl px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.98]';

export default function BiteSizedKnowledgeCard({ className = '' }) {
  const { item, loading } = useBiteSizedKnowledgeRandom({ enabled: true });
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div
        className={`${DASHBOARD_TILE_CLASS} border border-gray-100 bg-white shadow-sm animate-pulse ${className}`}
        aria-hidden
      />
    );
  }

  if (!item) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${DASHBOARD_TILE_CLASS} border border-gray-100 bg-white shadow-sm hover:border-gray-200 hover:shadow-md flex flex-col justify-end ${className}`}
        aria-label="깨알지식 열기"
      >
        <Lightbulb
          size={20}
          strokeWidth={ICON_STROKE}
          className="absolute top-3 right-3 text-[#064e3b] opacity-90"
          aria-hidden
        />
        <div className="relative min-w-0 pr-7">
          <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">INSIGHT</p>
          <p className="mt-1 text-base font-semibold tracking-tight text-slate-900">깨알지식</p>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="bite-sized-knowledge-modal"
            className="fixed inset-0 z-[320] flex items-center justify-center p-5 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="bite-sized-knowledge-question"
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="닫기"
              >
                <X size={20} strokeWidth={ICON_STROKE} aria-hidden />
              </button>

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#064e3b] mb-3">
                INSIGHT
              </p>
              <h2
                id="bite-sized-knowledge-question"
                className="pr-8 text-lg font-semibold text-slate-900 leading-snug tracking-tight"
              >
                {item.question}
              </h2>
              <p className="mt-4 text-sm font-light text-gray-600 leading-relaxed whitespace-pre-wrap">
                {item.answer}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
