import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Fetch one random active row from `bite_sized_knowledge` once on mount.
 * @param {{ enabled?: boolean }} options — skip fetch when false
 */
export function useBiteSizedKnowledgeRandom({ enabled = false } = {}) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setItem(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } = await supabase
          .from('bite_sized_knowledge')
          .select('id, question, answer')
          .eq('is_active', true);

        if (fetchErr) throw fetchErr;
        if (cancelled) return;

        const rows = Array.isArray(data) ? data : [];
        if (rows.length === 0) {
          setItem(null);
          return;
        }

        const pick = rows[Math.floor(Math.random() * rows.length)];
        setItem(pick);
      } catch (e) {
        if (!cancelled) {
          console.warn('[useBiteSizedKnowledgeRandom]', e);
          setError(e);
          setItem(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { item, loading, error };
}
