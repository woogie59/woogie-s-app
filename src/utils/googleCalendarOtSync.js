import { supabase } from '../lib/supabaseClient';

/**
 * OT blocked slot → 캘린더 동기화 (서버 경로).
 * 브라우저가 공개 Edge를 직접 부르지 않고 관리자 RPC를 거친다.
 * RPC는 작업 큐(ot_calendar_sync_jobs)에 적재만 하고, 실제 Google 호출은
 * google-calendar-sync-v2 함수가 claim 단위로 처리한다.
 * 전제: supabase/ot_calendar_outbox.sql + gcal_sync_hardening_v2.sql 적용 (같은 배포).
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
