import { supabase } from '../lib/supabaseClient';

/**
 * Admin OneSignal player id (`profiles.onesignal_id`) for role=admin.
 */
export async function fetchAdminOnesignalPlayerId() {
  const { data, error } = await supabase
    .from('profiles')
    .select('onesignal_id')
    .eq('role', 'admin')
    .not('onesignal_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[fetchAdminOnesignalPlayerId]', error.message);
    return null;
  }
  if (!data?.onesignal_id) return null;
  return String(data.onesignal_id);
}

/**
 * Push via deployed Edge Function `notify-admin-events` (no OneSignal keys in the browser).
 * @param {string} targetId — OneSignal player id (admin or member `profiles.onesignal_id`)
 */
export async function invokeNotifyAdminEvents(targetId, title, message) {
  if (!targetId) {
    console.warn('[invokeNotifyAdminEvents] missing targetId');
    return { error: new Error('missing targetId') };
  }
  const { data, error } = await supabase.functions.invoke('notify-admin-events', {
    body: {
      targetId,
      title,
      message,
    },
  });
  if (error) {
    console.warn('[notify-admin-events]', error.message);
    return { error, data };
  }
  return { data, error: null };
}
