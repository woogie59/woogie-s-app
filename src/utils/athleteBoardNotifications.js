import { supabase } from '../lib/supabaseClient';
import { invokeNotifyMemberEvents } from './notifications';

const BOARD_META_FIELDS = [
  'athlete_board_updated_at',
  'athlete_board_seen_at',
  'athlete_growth_updated_at',
  'athlete_growth_seen_at',
  'athlete_titles_updated_at',
  'athlete_titles_seen_at',
].join(', ');

function isUpdatedAfterSeen(updatedAt, seenAt) {
  if (!updatedAt) return false;
  if (!seenAt) return true;
  return new Date(updatedAt).getTime() > new Date(seenAt).getTime();
}

/** Member has unseen athlete board updates (home card). */
export function hasUnreadAthleteBoard(profile) {
  if (!profile?.is_athlete_system_enabled) return false;
  return isUpdatedAfterSeen(profile.athlete_board_updated_at, profile.athlete_board_seen_at);
}

/** Unseen growth / level / comment updates. */
export function hasUnreadAthleteGrowth(profile) {
  return isUpdatedAfterSeen(profile?.athlete_growth_updated_at, profile?.athlete_growth_seen_at);
}

/** Unseen title grants / unlocks. */
export function hasUnreadAthleteTitles(profile) {
  return isUpdatedAfterSeen(profile?.athlete_titles_updated_at, profile?.athlete_titles_seen_at);
}

export async function fetchAthleteBoardMeta(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select(BOARD_META_FIELDS)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[fetchAthleteBoardMeta]', error);
    return null;
  }
  return data;
}

/** Admin-side: bump section + optional push. section: 'growth' | 'titles' | 'all' */
export async function bumpAthleteBoardForMember(
  userId,
  { section = 'all', push = false, title, message } = {}
) {
  if (!userId) return { error: new Error('missing userId') };

  const { error: bumpErr } = await supabase.rpc('bump_athlete_board_updated', {
    p_user_id: userId,
    p_section: section,
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

/** Member opened 나의 상태 hub — clears home NEW only. */
export async function markAthleteBoardSeen() {
  const { data, error } = await supabase.rpc('mark_athlete_board_seen');
  if (error) {
    console.warn('[markAthleteBoardSeen]', error);
    return { ok: false, error };
  }
  return { ok: data?.ok !== false, error: null };
}

export async function markAthleteGrowthSeen() {
  const { data, error } = await supabase.rpc('mark_athlete_growth_seen');
  if (error) {
    console.warn('[markAthleteGrowthSeen]', error);
    return { ok: false, error };
  }
  return { ok: data?.ok !== false, error: null };
}

export async function markAthleteTitlesSeen() {
  const { data, error } = await supabase.rpc('mark_athlete_titles_seen');
  if (error) {
    console.warn('[markAthleteTitlesSeen]', error);
    return { ok: false, error };
  }
  return { ok: data?.ok !== false, error: null };
}

/** Small NEW pill for dark athlete UI buttons. */
export function AthleteSectionNewBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_0_8px_rgba(16,185,129,0.45)] ${className}`}
    >
      NEW
    </span>
  );
}
