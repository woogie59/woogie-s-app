import { supabase } from '../lib/supabaseClient';

const ONESIGNAL_API = 'https://onesignal.com/api/v1/notifications';

/**
 * Direct OneSignal push (player/subscription id from `profiles.onesignal_id`).
 * Note: Browser may block this request via CORS; if so, use a server proxy or Edge Function.
 */
export async function sendOneSignalPush(targetPlayerId, title, message) {
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  const restKey = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
  if (!appId || !restKey || !targetPlayerId) {
    console.warn('[sendOneSignalPush] Missing VITE_ONESIGNAL_APP_ID, VITE_ONESIGNAL_REST_API_KEY, or target');
    return { ok: false, error: 'missing_config' };
  }

  const res = await fetch(ONESIGNAL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${restKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_player_ids: [targetPlayerId],
      headings: { en: title },
      contents: { en: message },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('[sendOneSignalPush] OneSignal error:', json);
    return { ok: false, raw: json };
  }
  return { ok: true, raw: json };
}

/** Admin row for `profiles.onesignal_id` (OneSignal player id). */
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
