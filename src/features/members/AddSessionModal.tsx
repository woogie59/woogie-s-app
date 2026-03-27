import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';

type Props = {
  userId: string;
  onClose: () => void;
  onSaved?: () => void;
  initialTotalPrice?: number;
  initialTotalSessions?: number;
  initialUsedSessions?: number;
};

const clampInt = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
};

export default function AddSessionModal({
  userId,
  onClose,
  onSaved,
  initialTotalPrice = 0,
  initialTotalSessions = 0,
  initialUsedSessions = 0,
}: Props) {
  const { showAlert } = useGlobalModal();
  const [totalPrice, setTotalPrice] = useState<number>(clampInt(initialTotalPrice));
  const [totalSessions, setTotalSessions] = useState<number>(clampInt(initialTotalSessions));
  const [usedSessions, setUsedSessions] = useState<number>(clampInt(initialUsedSessions));
  const [saving, setSaving] = useState(false);

  const { remainingSessions, pricePerSession, error } = useMemo(() => {
    const remainingSessions = Math.max(0, totalSessions - usedSessions);
    const pricePerSession = totalSessions > 0 ? Math.round(totalPrice / totalSessions) : 0;

    let error = '';
    if (!userId) error = 'Missing user id.';
    else if (totalSessions <= 0) error = 'Total Sessions must be at least 1.';
    else if (usedSessions > totalSessions) error = 'Used Sessions cannot be greater than Total Sessions.';
    else if (totalPrice < 0) error = 'Total Price cannot be negative.';

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
      const { error: insertError } = await supabase.from('session_batches').insert({
        user_id: userId,
        total_count: totalSessions,
        remaining_count: remainingSessions,
        price_per_session: pricePerSession,
      });
      if (insertError) throw insertError;

      showAlert({ message: 'Saved!' });
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
        className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6 bg-black/80"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', damping: 24, stiffness: 220 }}
          className="w-full max-w-md bg-zinc-900 border border-yellow-500/20 rounded-2xl shadow-2xl shadow-black/50 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">Admin</p>
              <h3 className="text-xl font-serif text-yellow-500">Add Session Pack</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Total Price</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-yellow-600 outline-none transition-colors"
                value={totalPrice}
                onChange={(e) => setTotalPrice(clampInt(e.target.value))}
                placeholder="e.g. 500000"
                min={0}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Total Sessions</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={`w-full bg-zinc-950 border rounded-xl p-3 text-white outline-none transition-colors ${
                    error && totalSessions <= 0 ? 'border-red-500/70 focus:border-red-500' : 'border-zinc-800 focus:border-yellow-600'
                  }`}
                  value={totalSessions}
                  onChange={(e) => setTotalSessions(clampInt(e.target.value))}
                  placeholder="e.g. 10"
                  min={0}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Used Sessions</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={`w-full bg-zinc-950 border rounded-xl p-3 text-white outline-none transition-colors ${
                    usedSessions > totalSessions ? 'border-red-500/70 focus:border-red-500' : 'border-zinc-800 focus:border-yellow-600'
                  }`}
                  value={usedSessions}
                  onChange={(e) => setUsedSessions(clampInt(e.target.value))}
                  placeholder="0"
                  min={0}
                />
              </div>
            </div>

            <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-2xl p-4">
              <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mb-3">Auto-calculated</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3">
                  <p className="text-xs text-zinc-500 mb-1">Remaining Sessions</p>
                  <p className="text-lg font-serif text-white">{fmt(remainingSessions)}</p>
                </div>
                <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3">
                  <p className="text-xs text-zinc-500 mb-1">Price / Session</p>
                  <p className="text-lg font-serif text-white">{fmt(pricePerSession)}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!!error || saving}
              className="w-full bg-yellow-600 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 active:scale-[0.99] transition disabled:opacity-50 disabled:hover:bg-yellow-600"
            >
              {saving ? 'Saving...' : 'Save Session Pack'}
            </button>

            <p className="text-xs text-zinc-500 leading-relaxed">
              Remaining Sessions is computed as <span className="text-zinc-300">Total Sessions − Used Sessions</span>. Price per session is{' '}
              <span className="text-zinc-300">Total Price ÷ Total Sessions</span>.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

