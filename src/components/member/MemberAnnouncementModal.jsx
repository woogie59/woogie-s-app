import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { confirmMemberAnnouncement } from '../../utils/memberAnnouncements';

const ICON_STROKE = 1.5;

export default function MemberAnnouncementModal({ announcement, onClose }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!announcement?.id) return null;

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await confirmMemberAnnouncement(announcement.id, { dismissPermanent: dontShowAgain });
      onClose?.();
    } catch (e) {
      console.error('[MemberAnnouncementModal]', e);
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="member-announcement-backdrop"
        className="fixed inset-0 z-[330] flex items-center justify-center p-5 bg-black/50 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={handleConfirm}
        role="presentation"
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-announcement-title"
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1 w-full bg-gradient-to-r from-[#064e3b] via-[#0b5a45] to-[#064e3b]" aria-hidden />

          <div className="px-6 pt-6 pb-5">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
              aria-label="닫기"
            >
              <X size={20} strokeWidth={ICON_STROKE} aria-hidden />
            </button>

            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#064e3b] mb-3">
              NOTICE
            </p>
            <h2
              id="member-announcement-title"
              className="pr-8 text-xl font-semibold text-slate-900 leading-snug tracking-tight"
            >
              {announcement.title}
            </h2>
            <div className="mt-4 max-h-[min(50vh,280px)] overflow-y-auto overscroll-contain">
              <p className="text-sm font-normal text-gray-600 leading-relaxed whitespace-pre-wrap">
                {announcement.body}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/80">
            <label className="flex items-center gap-2.5 cursor-pointer select-none mb-4">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#064e3b] focus:ring-[#064e3b]/30"
              />
              <span className="text-sm text-gray-600">다시 보지 않기</span>
            </label>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full rounded-xl bg-neutral-950 py-3.5 text-[15px] font-semibold text-white tracking-wide hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? '처리 중…' : '확인'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
