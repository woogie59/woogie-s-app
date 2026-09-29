import { supabase } from '../lib/supabaseClient';
import { invokeNotifyAllMembers } from './notifications';

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

/** Until push QA is done, only this member receives announcement phone notifications. */
export const ANNOUNCEMENT_PUSH_QA_ONLY = true;
export const ANNOUNCEMENT_PUSH_QA_NAME = '테스트용1';

function previewAnnouncementBody(body, max = 160) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** Phone push. During QA, the edge function delivers only to 테스트용1. Does not throw. */
export async function notifyMembersAnnouncementPublished(title, body) {
  const heading = String(title || '').trim() || 'LAB DOT · 공지';
  const message = previewAnnouncementBody(body) || '새 공지가 게시되었습니다.';
  return invokeNotifyAllMembers(heading, message, 'member_announcement');
}
