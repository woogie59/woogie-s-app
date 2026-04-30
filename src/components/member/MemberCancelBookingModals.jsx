import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { invokeNotifyAdminEvents, fetchAdminOnesignalPlayerId } from '../../utils/notifications';
import { useGlobalModal } from '../../context/GlobalModalContext';
import {
  isMemberAppCancellationAllowed,
  MEMBER_CANCEL_COACH_CONTACT_MESSAGE,
} from '../../utils/bookingDateKeys';

const ICON_STROKE = 1;

/**
 * 내 일정·수업 예약 공통: 2h 잠금 안내 + 예약 취소(확인/로딩/성공) 모달
 *
 * @param {{ id: string, date: string, time: string } | null} openBooking
 *        — null이면 닫힘. 값이 있으면 취소 플로 열기(또는 잠금이면 policy만)
 * @param {(next: { id, date, time } | null) => void} onOpenBookingChange
 * @param {() => Promise<void>} onAfterSuccessConfirm — 성공 "확인" 후(목록/잔여 갱신)
 * @param {() => void} [onRequestPolicyLock] — 잠금 시(상위에서 detail 닫기 등)
 */
const MemberCancelBookingModals = ({
  user,
  memberDisplayName,
  openBooking,
  onOpenBookingChange,
  onAfterSuccessConfirm,
  onRequestPolicyLock,
}) => {
  const { showAlert } = useGlobalModal();
  const [showCancelPolicyLockModal, setShowCancelPolicyLockModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const [cancelDeleteModalView, setCancelDeleteModalView] = useState('confirm');
  const [cancelling, setCancelling] = useState(null);

  const resetDeleteFlow = useCallback(() => {
    setIsDeleteModalOpen(false);
    setBookingToDelete(null);
    setCancelDeleteModalView('confirm');
    setCancelling(null);
  }, []);

  useEffect(() => {
    if (!openBooking) return;
    const b = { id: openBooking.id, date: openBooking.date, time: openBooking.time };
    onOpenBookingChange(null);
    if (!isMemberAppCancellationAllowed(b)) {
      onRequestPolicyLock?.();
      setShowCancelPolicyLockModal(true);
      return;
    }
    setCancelDeleteModalView('confirm');
    setBookingToDelete(b);
    setIsDeleteModalOpen(true);
  }, [openBooking, onOpenBookingChange, onRequestPolicyLock]);

  const confirmDeleteAction = async () => {
    if (!bookingToDelete) return;
    const { id: bookingId, date, time } = bookingToDelete;
    if (cancelling === bookingId) return;
    if (!isMemberAppCancellationAllowed({ id: bookingId, date, time })) {
      resetDeleteFlow();
      setShowCancelPolicyLockModal(true);
      return;
    }
    setCancelling(bookingId);
    setCancelDeleteModalView('loading');
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);

    if (error) {
      showAlert({ message: '취소 실패: ' + error.message });
      setCancelling(null);
      setCancelDeleteModalView('confirm');
      return;
    }

    setCancelling(null);
    setCancelDeleteModalView('success');

    try {
      const pid = await fetchAdminOnesignalPlayerId();
      if (pid) {
        const memberName =
          memberDisplayName?.trim() ||
          user?.user_metadata?.full_name ||
          user?.email?.split('@')[0] ||
          '회원';
        await invokeNotifyAdminEvents(
          pid,
          '세션 취소 알림',
          `${memberName}님 - ${date} ${time} 예약이 취소되었습니다.`
        );
      }
    } catch (e) {
      console.warn('[MemberCancelBookingModals] cancel push:', e);
    }
  };

  const closeCancelSuccessAndRefresh = useCallback(async () => {
    resetDeleteFlow();
    if (onAfterSuccessConfirm) {
      await onAfterSuccessConfirm();
    }
  }, [onAfterSuccessConfirm, resetDeleteFlow]);

  return (
    <>
      <AnimatePresence>
        {showCancelPolicyLockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[310] flex items-center justify-center p-6 bg-gray-900/30 backdrop-blur-sm"
            onClick={() => setShowCancelPolicyLockModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-sm w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-6">
                <Lock size={40} strokeWidth={ICON_STROKE} className="text-gray-300" aria-hidden />
              </div>
              <p className="text-sm font-light text-slate-800 leading-relaxed tracking-wide">{MEMBER_CANCEL_COACH_CONTACT_MESSAGE}</p>
              <button
                type="button"
                onClick={() => setShowCancelPolicyLockModal(false)}
                className="w-full mt-8 py-3 rounded-xl text-sm font-light tracking-wide bg-[#064e3b] text-white shadow-sm hover:bg-[#053d2f] active:scale-[0.98] transition-all duration-200"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteModalOpen && bookingToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[320] flex items-center justify-center p-4 bg-gray-900/20"
            style={{ backdropFilter: 'blur(8px)' }}
            onClick={() => {
              if (cancelDeleteModalView === 'loading' || cancelDeleteModalView === 'success') return;
              resetDeleteFlow();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full max-w-md bg-white/95 border border-emerald-600/20 rounded-2xl shadow-xl shadow-gray-900/10 p-6 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {cancelDeleteModalView === 'success' ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                  <div
                    className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/80 ring-1 ring-emerald-500/25"
                    aria-hidden
                  >
                    <Check className="h-8 w-8 text-emerald-600" strokeWidth={2.5} />
                  </div>
                  <p className="text-base sm:text-lg font-medium text-slate-800 leading-snug tracking-tight">예약이 취소되었습니다.</p>
                  <button
                    type="button"
                    onClick={closeCancelSuccessAndRefresh}
                    className="mt-8 w-full max-w-xs py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] transition-all shadow-lg shadow-emerald-900/20 border border-emerald-600/30"
                  >
                    확인
                  </button>
                </div>
              ) : cancelDeleteModalView === 'loading' ? (
                <div
                  className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-2"
                  role="status"
                  aria-live="polite"
                >
                  <div
                    className="h-9 w-9 animate-spin rounded-full border-2 border-[#064e3b]/20 border-t-[#064e3b]"
                    aria-hidden
                  />
                  <p className="text-sm font-medium text-slate-600">처리 중…</p>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-serif text-[#064e3b] mb-2">예약 취소</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-2 whitespace-pre-line">
                    {bookingToDelete.date} {bookingToDelete.time}
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6 whitespace-pre-line">
                    해당 수업 예약을 취소하시겠습니까?
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={resetDeleteFlow}
                      className="px-5 py-3 rounded-xl text-gray-600 hover:text-emerald-700 hover:bg-gray-100 transition-all font-medium min-w-[80px]"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteAction}
                      className="px-5 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] transition-all shadow-lg shadow-emerald-900/20 border border-emerald-600/30 min-w-[80px]"
                    >
                      예, 취소할게요
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MemberCancelBookingModals;
