import { supabase } from '../lib/supabaseClient';
import { invokeNotifyMemberEvents } from './notifications';

const LS_GROWTH_SEEN = (uid) => `labdot:athlete-growth-seen:${uid}`;
const LS_TITLES_SEEN = (uid) => `labdot:athlete-titles-seen:${uid}`;

function maxTimestamp(...values) {
  const valid = values.filter(Boolean);
  if (!valid.length) return null;
  return valid.reduce((best, ts) => {
    const t = new Date(ts).getTime();
    if (!Number.isFinite(t)) return best;
    if (!best) return ts;
    return t > new Date(best).getTime() ? ts : best;
  }, null);
}

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
export function hasUnreadAthleteGrowth(signals) {
  if (!signals) return false;
  return isUpdatedAfterSeen(signals.growthUpdated, signals.effectiveGrowthSeen);
}

/** Unseen title grants / unlocks. */
export function hasUnreadAthleteTitles(signals) {
  if (!signals) return false;
  return isUpdatedAfterSeen(signals.titlesUpdated, signals.effectiveTitlesSeen);
}

/**
 * Load NEW signals from profiles columns + latest growth_records / member_titles (fallback).
 * effective*Seen includes hub visit time so old records don't false-positive.
 */
export async function fetchAthleteBoardSignals(userId) {
  if (!userId) return null;

  const lsGrowthSeen = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_GROWTH_SEEN(userId)) : null;
  const lsTitlesSeen = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_TITLES_SEEN(userId)) : null;

  const [metaRes, growthRes, titlesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'athlete_board_updated_at,athlete_board_seen_at,athlete_growth_updated_at,athlete_growth_seen_at,athlete_titles_updated_at,athlete_titles_seen_at,is_athlete_system_enabled'
      )
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('growth_records')
      .select('created_at,updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('member_titles')
      .select('granted_at')
      .eq('user_id', userId)
      .order('granted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (metaRes.error) {
    console.warn('[fetchAthleteBoardSignals] profiles', metaRes.error);
  }

  const meta = metaRes.data || {};
  const growthRow = growthRes.error ? null : growthRes.data;
  const titleRow = titlesRes.error ? null : titlesRes.data;

  const growthUpdated = maxTimestamp(
    meta.athlete_growth_updated_at,
    growthRow?.updated_at,
    growthRow?.created_at
  );
  const titlesUpdated = maxTimestamp(meta.athlete_titles_updated_at, titleRow?.granted_at);

  const effectiveGrowthSeen = maxTimestamp(meta.athlete_growth_seen_at, lsGrowthSeen);
  const effectiveTitlesSeen = maxTimestamp(meta.athlete_titles_seen_at, lsTitlesSeen);

  return {
    meta,
    growthUpdated,
    titlesUpdated,
    effectiveGrowthSeen,
    effectiveTitlesSeen,
  };
}

/** @deprecated use fetchAthleteBoardSignals */
export async function fetchAthleteBoardMeta(userId) {
  const signals = await fetchAthleteBoardSignals(userId);
  return signals?.meta ?? null;
}

/** Admin-side: bump section + optional push. section: 'growth' | 'titles' | 'all' */
export async function bumpAthleteBoardForMember(
  userId,
  { section = 'all', push = false, title, message } = {}
) {
  if (!userId) return { error: new Error('missing userId') };

  let bumpErr = null;
  const withSection = await supabase.rpc('bump_athlete_board_updated', {
    p_user_id: userId,
    p_section: section,
  });
  bumpErr = withSection.error;

  if (bumpErr) {
    const legacy = await supabase.rpc('bump_athlete_board_updated', { p_user_id: userId });
    bumpErr = legacy.error;
  }

  if (bumpErr) {
    console.error('[bumpAthleteBoardForMember]', bumpErr);
  }

  if (push && title && message) {
    try {
      await invokeNotifyMemberEvents(userId, title, message, 'athlete_status');
    } catch (e) {
      console.warn('[bumpAthleteBoardForMember] push:', e);
    }
  }

  return { error: bumpErr };
}

/** Member opened 나의 상태 hub — clears home NEW only. */
export async function markAthleteBoardSeen() {
  const { data, error } = await supabase.rpc('mark_athlete_board_seen');
  if (error) console.warn('[markAthleteBoardSeen]', error);
  return { ok: !error && data?.ok !== false, error: error ?? null };
}

export async function markAthleteGrowthSeen(userId) {
  const now = new Date().toISOString();
  if (userId && typeof localStorage !== 'undefined') {
    localStorage.setItem(LS_GROWTH_SEEN(userId), now);
  }
  const { data, error } = await supabase.rpc('mark_athlete_growth_seen');
  if (error) console.warn('[markAthleteGrowthSeen]', error);
  return { ok: !error || !!userId, error: error ?? null };
}

export async function markAthleteTitlesSeen(userId) {
  const now = new Date().toISOString();
  if (userId && typeof localStorage !== 'undefined') {
    localStorage.setItem(LS_TITLES_SEEN(userId), now);
  }
  const { data, error } = await supabase.rpc('mark_athlete_titles_seen');
  if (error) console.warn('[markAthleteTitlesSeen]', error);
  return { ok: !error || !!userId, error: error ?? null };
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
