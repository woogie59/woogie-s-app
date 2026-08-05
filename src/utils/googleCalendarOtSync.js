import { supabase } from '../lib/supabaseClient';

/** OT blocked slot → google-calendar-sync edge function */
export async function invokeOtBlockGoogleSync(type, record, oldRecord = null) {
  const body = {
    type,
    table: 'trainer_blocked_slots',
    schema: 'public',
    record: record ?? null,
    old_record: oldRecord ?? null,
  };

  const { data, error } = await supabase.functions.invoke('google-calendar-sync', { body });
  if (error) {
    console.warn('[invokeOtBlockGoogleSync]', error.message);
    return { ok: false, error };
  }
  if (data?.error) {
    console.warn('[invokeOtBlockGoogleSync] response error:', data.error);
    return { ok: false, error: data.error };
  }
  return { ok: true, data };
}
