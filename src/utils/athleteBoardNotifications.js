import { supabase } from '../lib/supabaseClient';
import { invokeNotifyMemberEvents } from './notifications';

/** Member has unseen athlete board updates (admin saved after last visit). */
export function hasUnreadAthleteBoard(profile) {
  if (!profile?.is_athlete_system_enabled) return false;
  const updated = profile.athlete_board_updated_at;
  if (!updated) return false;
  const seen = profile.athlete_board_seen_at;
  if (!seen) return true;
  return new Date(updated).getTime() > new Date(seen).getTime();
}

/** Admin-side: bump updated_at; optionally send member push for major events. */
export async function bumpAthleteBoardForMember(userId, { push = false, title, message } = {}) {
  if (!userId) return { error: new Error('missing userId') };

  const { error: bumpErr } = await supabase.rpc('bump_athlete_board_updated', {
    p_user_id: userId,
  });
  if (bumpErr) {
    console.error('[bumpAthleteBoardForMember]', bumpErr);
    return { error: bumpErr };
  }

  if (push && title && message) {
    try {
      await invokeNotifyMemberEvents(userId, title, message, 'athlete_status');
    } catch (e) {
      console.warn('[bumpAthleteBoardForMember] push:', e);
    }
  }

  return { error: null };
}

/** Member opened 나의 상태 — clears NEW badge via seen_at. */
export async function markAthleteBoardSeen() {
  const { data, error } = await supabase.rpc('mark_athlete_board_seen');
  if (error) {
    console.warn('[markAthleteBoardSeen]', error);
    return { ok: false, error };
  }
  return { ok: data?.ok !== false, error: null };
}
