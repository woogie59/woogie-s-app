import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import GrowthLedgerTimeline from './GrowthLedgerTimeline';

/**
 * Fetches `growth_records` for the target user and binds to {@link GrowthLedgerTimeline}.
 * @param {{ targetUserId: string | null | undefined, refreshKey?: number }} props
 */
export default function MemberGrowthLedger({ targetUserId, refreshKey = 0 }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetUserId) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('growth_records')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setLoading(false);
      if (error) {
        console.error('[MemberGrowthLedger] growth_records', error);
        setEntries([]);
        return;
      }
      setEntries(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUserId, refreshKey]);

  return <GrowthLedgerTimeline entries={entries} loading={loading} />;
}
