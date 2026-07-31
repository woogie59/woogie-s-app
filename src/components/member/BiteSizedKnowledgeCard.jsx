import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { useBiteSizedKnowledgeRandom } from '../../hooks/useBiteSizedKnowledgeRandom';

const ICON_STROKE = 1.5;

export default function BiteSizedKnowledgeCard() {
  const { item, loading } = useBiteSizedKnowledgeRandom({ enabled: true });
  const [open, setOpen] = useState(false);

  if (loading || !item) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:border-gray-200 hover:shadow-md active:scale-95 flex items-start gap-3.5"
        aria-label="깨알지식 열기"
      >
        <Lightbulb
          size={22}
          strokeWidth={ICON_STROKE}
          className="shrink-0 text-[#064e3b] mt-0.5"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900 tracking-tight">깨알지식</p>
          <p className="mt-0.5 text-xs font-light text-gray-500 tracking-wide">오늘의 트레이닝 팩트</p>
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
                깨알지식
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
