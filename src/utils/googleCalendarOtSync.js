import { supabase } from '../lib/supabaseClient';

/**
 * OT blocked slot → google-calendar-sync (서버 경로).
 * 브라우저가 공개 Edge를 직접 부르지 않고 관리자 RPC를 거친다.
 * RPC가 공유 비밀과 함께 서버에서 google-calendar-sync를 호출한다.
 * 전제: supabase/gcal_sync_hardening.sql 적용 (같은 배포).
 */
export async function invokeOtBlockGoogleSync(type, record, oldRecord = null) {
  const blockId = record?.id ?? oldRecord?.id ?? null;
  if (!blockId) {
    console.warn('[invokeOtBlockGoogleSync] missing block id');
    return { ok: false, error: 'missing block id' };
  }
  const { data, error } = await supabase.rpc('admin_block_calendar_sync', {
    p_op: type,
    p_block_id: blockId,
    p_old: oldRecord ?? null,
  });
  if (error) {
    console.warn('[invokeOtBlockGoogleSync]', error.message);
    return { ok: false, error };
  }
  if (data?.ok === false || data?.error) {
    console.warn('[invokeOtBlockGoogleSync] response error:', data?.error || data);
    return { ok: false, error: data?.error || data };
  }
  return { ok: true, data };
}
