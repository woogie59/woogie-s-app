import { supabase } from '../lib/supabaseClient';

/**
 * Direct OneSignal REST push from the client (uses VITE_* env from .env).
 */
export const sendDirectPush = async (targetPlayerId, title, message) => {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${import.meta.env.VITE_ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: import.meta.env.VITE_ONESIGNAL_APP_ID,
        include_player_ids: [targetPlayerId],
        headings: { en: title },
        contents: { en: message },
      }),
    });
    const data = await response.json();
    console.log('🚀 Direct Push Sent:', data);
  } catch (error) {
    console.error('🚨 Direct Push Failed:', error);
  }
};

/** Admin `profiles.onesignal_id` (OneSignal player id). */
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
