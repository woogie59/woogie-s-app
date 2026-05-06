import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import GrowthLedgerTimeline from './GrowthLedgerTimeline';

/**
 * Fetches `exp_logs` for the target user and binds to {@link GrowthLedgerTimeline}.
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
        .from('exp_logs')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      console.log('Fetched Ledger:', data);
      if (cancelled) return;
      setLoading(false);
      if (error) {
        console.error('[MemberGrowthLedger] exp_logs', error);
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
