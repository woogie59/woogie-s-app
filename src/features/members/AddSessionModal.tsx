import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';

/** Row from `session_batches` — purchase snapshot */
export type SessionBatchRow = {
  id: string;
  total_count: number;
  remaining_count: number;
  price_per_session: number;
  price?: number | null;
};

type Props = {
  userId: string;
  onClose: () => void;
  onSaved?: () => void;
  mode?: 'create' | 'edit';
  editBatch?: SessionBatchRow | null;
};

const clampInt = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
};

type NumericInput = '' | string;

const toNumericInput = (n: unknown): NumericInput => {
  const v = clampInt(n);
  return v === 0 ? '' : String(v);
};

const toNumberOrZero = (v: NumericInput) => (v === '' ? 0 : clampInt(v));

export default function AddSessionModal({
  userId,
  onClose,
  onSaved,
  mode = 'create',
  editBatch = null,
}: Props) {
  const { showAlert } = useGlobalModal();

  const defaults =
    mode === 'edit' && editBatch
      ? {
          totalSessions: toNumericInput(editBatch.total_count),
          pricePerSession: toNumericInput(editBatch.price_per_session),
        }
      : { totalSessions: '' as NumericInput, pricePerSession: '' as NumericInput };

  const [totalSessions, setTotalSessions] = useState<NumericInput>(defaults.totalSessions);
  const [pricePerSession, setPricePerSession] = useState<NumericInput>(defaults.pricePerSession);
  const [saving, setSaving] = useState(false);

  /** 수정 시 이미 사용된 횟수 — 입력란 없이 배치에서만 계산 */
  const usedFromBatch =
    mode === 'edit' && editBatch ? Math.max(0, editBatch.total_count - editBatch.remaining_count) : 0;

  const { error } = useMemo(() => {
    const totalSessionsN = toNumberOrZero(totalSessions);
    const pricePerSessionN = toNumberOrZero(pricePerSession);
    let err = '';
    if (!userId) err = '회원 정보가 없습니다.';
    else if (totalSessionsN < 1) err = '횟수는 1 이상이어야 합니다.';
    else if (usedFromBatch > totalSessionsN) err = '횟수는 이미 사용된 횟수보다 작을 수 없습니다.';
    else if (pricePerSessionN < 0) err = '회당 단가는 0 이상이어야 합니다.';
    return { error: err };
  }, [totalSessions, pricePerSession, userId, usedFromBatch]);

  const handleSave = async () => {
    if (error) {
      showAlert({ title: '입력 확인', message: error });
      return;
    }
    setSaving(true);
    try {
      const totalSessionsN = toNumberOrZero(totalSessions);
      const pricePerSessionN = toNumberOrZero(pricePerSession);
      const newRemaining = Math.max(0, totalSessionsN - usedFromBatch);
      const packPrice = totalSessionsN * pricePerSessionN;

      if (mode === 'edit' && editBatch) {
        const deltaRemaining = newRemaining - editBatch.remaining_count;

        const { error: updateError } = await supabase
          .from('session_batches')
          .update({
            total_count: totalSessionsN,
            remaining_count: newRemaining,
            price_per_session: pricePerSessionN,
            price: packPrice,
          })
          .eq('id', editBatch.id);
        if (updateError) throw updateError;

        const { data: profileRow, error: profileFetchError } = await supabase
          .from('profiles')
          .select('remaining_sessions')
          .eq('id', userId)
          .single();
        if (profileFetchError) throw profileFetchError;

        const nextProfileRemaining = Math.max(0, (profileRow?.remaining_sessions ?? 0) + deltaRemaining);
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            remaining_sessions: nextProfileRemaining,
            price_per_session: pricePerSessionN,
          })
          .eq('id', userId);
        if (profileUpdateError) throw profileUpdateError;

        showAlert({ message: '수강권이 수정되었습니다.' });
      } else {
        const { error: insertError } = await supabase.from('session_batches').insert({
          user_id: userId,
          total_count: totalSessionsN,
          remaining_count: newRemaining,
          price_per_session: pricePerSessionN,
          price: packPrice,
        });
        if (insertError) throw insertError;

        const { data: profileRow, error: profileFetchError } = await supabase
          .from('profiles')
          .select('remaining_sessions')
          .eq('id', userId)
          .single();
        if (profileFetchError) throw profileFetchError;

        const nextRemaining = (profileRow?.remaining_sessions ?? 0) + newRemaining;
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            remaining_sessions: nextRemaining,
            price_per_session: pricePerSessionN,
          })
          .eq('id', userId);
        if (profileUpdateError) throw profileUpdateError;

        showAlert({ message: '수강권이 등록되었습니다.' });
      }

      onSaved?.();
      onClose();
    } catch (e: unknown) {
      console.error('AddSessionModal save error:', e);
      const msg = e instanceof Error ? e.message : '저장에 실패했습니다.';
      showAlert({ title: '저장 실패', message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm bg-white px-8 py-10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-start justify-between gap-4 mb-10">
          <h3 className="text-lg font-semibold text-neutral-900 tracking-tight">
            {mode === 'edit' ? '수강권 수정' : '수강권 등록'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors"
            aria-label="닫기"
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-8">
          <div>
            <label htmlFor="total-sessions" className="block text-sm font-medium text-neutral-800 mb-2">
              횟수 (Total Sessions)
            </label>
            <input
              id="total-sessions"
              type="number"
              inputMode="numeric"
              min={1}
              className="w-full border-0 border-b border-neutral-900/20 bg-transparent py-2 text-xl font-semibold tabular-nums text-neutral-950 outline-none focus:border-neutral-900 transition-colors"
              value={totalSessions}
              onChange={(e) => setTotalSessions(e.target.value === '' ? '' : String(clampInt(e.target.value)))}
              placeholder="0"
            />
          </div>

          <div>
            <label htmlFor="price-per-session" className="block text-sm font-medium text-neutral-800 mb-2">
              회당 단가 (Price per Session)
            </label>
            <input
              id="price-per-session"
              type="number"
              inputMode="numeric"
              min={0}
              className="w-full border-0 border-b border-neutral-900/20 bg-transparent py-2 text-xl font-semibold tabular-nums text-neutral-950 outline-none focus:border-neutral-900 transition-colors"
              value={pricePerSession}
              onChange={(e) => setPricePerSession(e.target.value === '' ? '' : String(clampInt(e.target.value)))}
              placeholder="0"
            />
            <p className="mt-2 text-xs text-neutral-500">원 · 회당</p>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={handleSave}
            disabled={!!error || saving}
            className="w-full mt-4 bg-neutral-950 text-white text-[15px] font-semibold py-3.5 tracking-wide hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {saving ? '처리 중…' : mode === 'edit' ? '저장' : '수강권 등록'}
          </button>
        </div>
      </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
