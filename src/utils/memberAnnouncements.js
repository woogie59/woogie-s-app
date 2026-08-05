import { supabase } from '../lib/supabaseClient';
import { MEMBER_ANNOUNCEMENT_QA_PROFILE_NAME } from './bookingDateKeys';

export function isMemberAnnouncementQaProfile(profileName) {
  return String(profileName || '').trim() === MEMBER_ANNOUNCEMENT_QA_PROFILE_NAME;
}

/** @returns {Promise<{ id: string, title: string, body: string, published_at?: string } | null>} */
export async function fetchActiveMemberAnnouncement() {
  const { data, error } = await supabase.rpc('get_active_member_announcement');
  if (error) {
    console.warn('[fetchActiveMemberAnnouncement]', error.message);
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const id = data.id;
  if (!id) return null;
  return {
    id: String(id),
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    published_at: data.published_at ? String(data.published_at) : undefined,
  };
}

export async function confirmMemberAnnouncement(announcementId, { dismissPermanent = false } = {}) {
  const { data, error } = await supabase.rpc('confirm_member_announcement', {
    p_announcement_id: announcementId,
    p_dismiss_permanent: dismissPermanent,
  });
  if (error) throw error;
  if (data?.ok === false) {
    throw new Error(data?.error || 'confirm_failed');
  }
  return data;
}
