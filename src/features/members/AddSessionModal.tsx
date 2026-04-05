import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';

/** Row from `session_batches` — purchase snapshot (not a FK to a catalog pack). */
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
  /** create = new pack; edit = update existing `session_batches` row */
  mode?: 'create' | 'edit';
  editBatch?: SessionBatchRow | null;
  initialTotalPrice?: number;
  initialTotalSessions?: number;
  initialUsedSessions?: number;
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

function initialFormFromEdit(batch: SessionBatchRow) {
  const used = Math.max(0, batch.total_count - batch.remaining_count);
  const packPrice =
    batch.price != null && Number.isFinite(Number(batch.price))
      ? Number(batch.price)
      : batch.price_per_session * batch.total_count;
  return {
    totalPrice: toNumericInput(packPrice),
    totalSessions: toNumericInput(batch.total_count),
    usedSessions: toNumericInput(used),
  };
}

export default function AddSessionModal({
  userId,
  onClose,
  onSaved,
  mode = 'create',
  editBatch = null,
  initialTotalPrice = 0,
  initialTotalSessions = 0,
  initialUsedSessions = 0,
}: Props) {
  const { showAlert } = useGlobalModal();
  const defaults =
    mode === 'edit' && editBatch
      ? initialFormFromEdit(editBatch)
      : {
          totalPrice: toNumericInput(initialTotalPrice),
          totalSessions: toNumericInput(initialTotalSessions),
          usedSessions: toNumericInput(initialUsedSessions),
        };
  const [totalPrice, setTotalPrice] = useState<NumericInput>(defaults.totalPrice);
  const [totalSessions, setTotalSessions] = useState<NumericInput>(defaults.totalSessions);
  const [usedSessions, setUsedSessions] = useState<NumericInput>(defaults.usedSessions);
  const [saving, setSaving] = useState(false);

  const { remainingSessions, pricePerSession, error } = useMemo(() => {
    const totalPriceN = toNumberOrZero(totalPrice);
    const totalSessionsN = toNumberOrZero(totalSessions);
    const usedSessionsN = toNumberOrZero(usedSessions);

    const remainingSessions = Math.max(0, totalSessionsN - usedSessionsN);
    const pricePerSession = totalSessionsN > 0 ? Math.round(totalPriceN / totalSessionsN) : 0;

    let error = '';
    if (!userId) error = 'Missing user id.';
    else if (totalSessionsN <= 0) error = 'Total Sessions must be at least 1.';
    else if (usedSessionsN > totalSessionsN) error = 'Used Sessions cannot be greater than Total Sessions.';
    else if (totalPriceN < 0) error = 'Total Price cannot be negative.';

    return { remainingSessions, pricePerSession, error };
  }, [totalPrice, totalSessions, usedSessions, userId]);

  const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : '0');

  const handleSave = async () => {
    if (error) {
      showAlert({ title: 'Invalid input', message: error });
      return;
    }
    setSaving(true);
    try {
      const totalPriceN = toNumberOrZero(totalPrice);
      const totalSessionsN = toNumberOrZero(totalSessions);
      const newRemaining = remainingSessions;

      if (mode === 'edit' && editBatch) {
        const deltaRemaining = newRemaining - editBatch.remaining_count;

        const { error: updateError } = await supabase
          .from('session_batches')
          .update({
            total_count: totalSessionsN,
            remaining_count: newRemaining,
            price_per_session: pricePerSession,
            price: totalPriceN,
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
            price_per_session: pricePerSession,
          })
          .eq('id', userId);
        if (profileUpdateError) throw profileUpdateError;

        showAlert({ message: '세션 팩이 수정되었습니다.' });
      } else {
        // `price` = pack total (KRW); Revenue screen sums this for the selected month
        const { error: insertError } = await supabase.from('session_batches').insert({
          user_id: userId,
          total_count: totalSessionsN,
          remaining_count: newRemaining,
          price_per_session: pricePerSession,
          price: totalPriceN,
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
            price_per_session: pricePerSession,
          })
          .eq('id', userId);
        if (profileUpdateError) throw profileUpdateError;

        showAlert({ message: 'Saved!' });
      }

      onSaved?.();
      onClose();
    } catch (e: any) {
      console.error('AddSessionModal save error:', e);
      showAlert({ title: 'Save failed', message: e?.message || 'Unknown error' });
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
        className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6 bg-gray-900/20"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', damping: 24, stiffness: 220 }}
          className="w-full max-w-md bg-white border border-emerald-600/20 rounded-2xl shadow-xl shadow-gray-900/10 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-gray-500">Admin</p>
              <h3 className="text-xl font-serif text-emerald-600">
                {mode === 'edit' ? '세션 팩 수정' : 'Add Session Pack'}
              </h3>
              {mode === 'edit' && editBatch && (
                <p className="text-xs text-gray-500 mt-1 font-mono truncate" title={editBatch.id}>
                  ID · {editBatch.id.slice(0, 8)}…
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-emerald-700 hover:bg-gray-100 transition"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-600 uppercase tracking-wider block mb-2">Total Price</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-slate-900 focus:border-emerald-600 outline-none transition-colors"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value === '' ? '' : String(clampInt(e.target.value)))}
                placeholder="e.g. 500000"
                min={0}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 uppercase tracking-wider block mb-2">Total Sessions</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={`w-full bg-gray-50 border rounded-xl p-3 text-slate-900 outline-none transition-colors ${
                    error && toNumberOrZero(totalSessions) <= 0 ? 'border-red-500/70 focus:border-red-500' : 'border-gray-200 focus:border-emerald-600'
                  }`}
                  value={totalSessions}
                  onChange={(e) => setTotalSessions(e.target.value === '' ? '' : String(clampInt(e.target.value)))}
                  placeholder="e.g. 10"
                  min={0}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 uppercase tracking-wider block mb-2">Used Sessions</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={`w-full bg-gray-50 border rounded-xl p-3 text-slate-900 outline-none transition-colors ${
                    toNumberOrZero(usedSessions) > toNumberOrZero(totalSessions)
                      ? 'border-red-500/70 focus:border-red-500'
                      : 'border-gray-200 focus:border-emerald-600'
                  }`}
                  value={usedSessions}
                  onChange={(e) => setUsedSessions(e.target.value === '' ? '' : String(clampInt(e.target.value)))}
                  placeholder="0"
                  min={0}
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
              <p className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-3">Auto-calculated</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Remaining Sessions</p>
                  <p className="text-lg font-serif text-slate-900">{fmt(remainingSessions)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Price / Session</p>
                  <p className="text-lg font-serif text-slate-900">{fmt(pricePerSession)}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!!error || saving}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-500 active:scale-[0.99] transition disabled:opacity-50 disabled:hover:bg-emerald-600"
            >
              {saving ? 'Saving...' : mode === 'edit' ? '수정 저장' : 'Save Session Pack'}
            </button>

            <p className="text-xs text-gray-600 leading-relaxed">
              Remaining Sessions is computed as <span className="text-gray-900">Total Sessions − Used Sessions</span>. Price per session is{' '}
              <span className="text-gray-900">Total Price ÷ Total Sessions</span>.
              {mode === 'edit' && (
                <>
                  {' '}
                  이 행은 구매 시점 스냅샷(<code className="text-[11px]">session_batches</code>)만 바뀌며, 다른 회원·다른 구매 건에는 영향 없습니다.
                </>
              )}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

