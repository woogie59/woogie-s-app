import { supabase } from '../lib/supabaseClient';

/**
 * Load admin push target: query `profiles` first, then RPC if RLS hides the admin row.
 * @returns {{ adminProfile: { onesignal_id: string } | null, error: Error | null }}
 */
export async function fetchAdminOnesignalProfile() {
  const { data: adminProfile, error } = await supabase
    .from('profiles')
    .select('onesignal_id')
    .eq('role', 'admin')
    .not('onesignal_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[fetchAdminOnesignalProfile] profiles', error.message);
  }
  if (adminProfile?.onesignal_id) {
    return { adminProfile: { onesignal_id: String(adminProfile.onesignal_id) }, error: null };
  }

  const { data: rpcId, error: rpcError } = await supabase.rpc('get_admin_onesignal_player_id');
  if (rpcError) {
    console.warn('[fetchAdminOnesignalProfile] rpc', rpcError.message);
    return { adminProfile: null, error: rpcError };
  }
  if (rpcId == null || rpcId === '') {
    return { adminProfile: null, error: null };
  }
  return { adminProfile: { onesignal_id: String(rpcId) }, error: null };
}

/**
 * Admin OneSignal player id (`profiles.onesignal_id`) for role=admin.
 */
export async function fetchAdminOnesignalPlayerId() {
  const { adminProfile } = await fetchAdminOnesignalProfile();
  return adminProfile?.onesignal_id ?? null;
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
