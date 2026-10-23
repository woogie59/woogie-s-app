import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Link2, Plus, Copy, Ban, CalendarPlus, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import { invokeOtBlockGoogleSync } from '../../utils/googleCalendarOtSync';

const DEEP_GREEN = '#064e3b';

/** 검토용 데모 (?demo=1): 더미 데이터로 화면만 재생. 어떤 읽기/쓰기도 서버에 나가지 않는다. */
const IS_DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';

const DEMO_LINKS = [
  { id: 'demo-link-1', token: '11111111-2222-3333-4444-555555555555', member_name: '김오티', label: '10월 소개', max_sessions: 2, revoked_at: null, created_at: new Date().toISOString() },
  { id: 'demo-link-2', token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', member_name: '박오티', label: null, max_sessions: 2, revoked_at: new Date().toISOString(), created_at: new Date().toISOString() },
];

const DEMO_BOOKINGS_BY_LINK = {
  'demo-link-1': [
    { id: 'demo-b1', link_id: 'demo-link-1', date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), time: '15:00', name: '김오티', status: 'confirmed', block_id: 'demo-block-1', calendar_synced_at: null, admin_notified_at: new Date().toISOString() },
    { id: 'demo-b2', link_id: 'demo-link-1', date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), time: '14:00', name: '김오티', status: 'completed', block_id: 'demo-block-2', calendar_synced_at: new Date().toISOString(), admin_notified_at: new Date().toISOString() },
  ],
};

function linkUrl(token) {
  return `${window.location.origin}/ot/${token}`;
}

/** 오티 1인용 신청 링크 발급·관리 (관리자 전용) */
export default function AdminOtLinks({ goBack }) {
  const { showAlert, showConfirm } = useGlobalModal();
  const [links, setLinks] = useState([]);
  const [bookingsByLink, setBookingsByLink] = useState({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    if (IS_DEMO) {
      setLinks(DEMO_LINKS);
      setBookingsByLink(DEMO_BOOKINGS_BY_LINK);
      setLoading(false);
      return;
    }
    const { data: linkRows, error } = await supabase
      .from('ot_links')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      showAlert({ message: '오티 링크 조회 실패: ' + error.message });
      setLoading(false);
      return;
    }
    setLinks(linkRows || []);
    const ids = (linkRows || []).map((l) => l.id);
    if (ids.length > 0) {
      const { data: bookingRows } = await supabase
        .from('ot_bookings')
        .select('*')
        .in('link_id', ids)
        .order('date', { ascending: true });
      const map = {};
      (bookingRows || []).forEach((b) => {
        if (!map[b.link_id]) map[b.link_id] = [];
        map[b.link_id].push(b);
      });
      setBookingsByLink(map);
    } else {
      setBookingsByLink({});
    }
    setLoading(false);
  }, [showAlert]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const demoBlocked = () => showAlert({ message: '검토용 데모 화면입니다. 실제 발급·폐기·완료·취소·동기화는 되지 않습니다.' });

  const doCreate = async (name, label) => {
    setCreating(true);
    const { data, error } = await supabase
      .from('ot_links')
      .insert({ member_name: name, label: label || null })
      .select()
      .single();
    setCreating(false);
    if (error) {
      showAlert({ message: '링크 만들기 실패: ' + error.message });
      return;
    }
    setNewName('');
    setNewLabel('');
    await fetchAll();
    try {
      await navigator.clipboard.writeText(linkUrl(data.token));
      showAlert({ message: `${name}님 전용 링크를 만들고 주소를 복사했습니다. 카톡으로 붙여넣어 보내면 됩니다.` });
    } catch {
      showAlert({ message: `${name}님 전용 링크를 만들었습니다. 목록에서 주소를 복사해 보내 주세요.` });
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    if (IS_DEMO) { demoBlocked(); return; }
    const name = newName.trim();
    if (!name) {
      showAlert({ message: '오티 대상자 이름을 적어 주세요.' });
      return;
    }
    if (name.length > 30) {
      showAlert({ message: '이름은 30자까지 가능합니다.' });
      return;
    }
    // 같은 이름의 살아있는 링크가 있으면 한 번 더 확인 (링크당 2회 제한 우회 방지)
    const dup = links.find((l) => !l.revoked_at && (l.member_name || '').trim() === name);
    if (dup) {
      showConfirm({
        title: '같은 이름의 링크가 있습니다',
        message: `${name} 이름으로 사용 중인 링크가 이미 있습니다. 같은 분이면 기존 링크를 다시 보내 주세요. 그래도 새로 만들까요?`,
        confirmLabel: '새로 만들기',
        onConfirm: () => doCreate(name, newLabel.trim() || null),
      });
      return;
    }
    await doCreate(name, newLabel.trim() || null);
  };

  const handleCopy = async (token) => {
    try {
      await navigator.clipboard.writeText(linkUrl(token));
      showAlert({ message: '링크 주소를 복사했습니다.' });
    } catch {
      showAlert({ message: linkUrl(token) });
    }
  };

  const handleRevoke = (link) => {
    if (IS_DEMO) { demoBlocked(); return; }
    showConfirm({
      title: '링크 폐기',
      message: '이 링크를 폐기하면 더 이상 신청할 수 없습니다. 이미 잡힌 신청은 그대로 둡니다.',
      confirmLabel: '폐기',
      onConfirm: async () => {
        const { error } = await supabase
          .from('ot_links')
          .update({ revoked_at: new Date().toISOString() })
          .eq('id', link.id);
        if (error) {
          showAlert({ message: '폐기 실패: ' + error.message });
          return;
        }
        await fetchAll();
      },
    });
  };

  /** 캘린더 등록이 실패했을 때 수동 재시도 */
  const handleCalendarResync = async (booking) => {
    if (IS_DEMO) { demoBlocked(); return; }
    if (!booking.block_id || syncingId) return;
    setSyncingId(booking.id);
    const record = {
      id: booking.block_id,
      block_date: String(booking.date).slice(0, 10),
      block_time: booking.time,
      label: 'OT',
      kind: 'ot',
      member_name: booking.name,
    };
    const res = await invokeOtBlockGoogleSync('INSERT', record);
    setSyncingId(null);
    if (res.ok) {
      await supabase
        .from('ot_bookings')
        .update({ calendar_synced_at: new Date().toISOString() })
        .eq('id', booking.id);
      await fetchAll();
      showAlert({ message: '캘린더 등록을 다시 시도했습니다. 캘린더에서 확인해 주세요.' });
    } else {
      showAlert({ message: '캘린더 등록에 실패했습니다. 설정을 확인해 주세요.' });
    }
  };

  const handleComplete = async (booking) => {
    if (IS_DEMO) { demoBlocked(); return; }
    const { data, error } = await supabase.rpc('ot_admin_complete', { p_booking_id: booking.id });
    if (error || !data?.ok) {
      showAlert({ message: '완료 처리 실패: ' + (error?.message || data?.reason || '') });
      return;
    }
    await fetchAll();
  };

  const handleAdminCancel = (booking) => {
    if (IS_DEMO) { demoBlocked(); return; }
    showConfirm({
      title: '신청 취소',
      message: `${booking.name}님 ${String(booking.date).slice(0, 10)} ${booking.time} 신청을 취소합니다. 자리는 바로 열리고 횟수는 돌아갑니다.`,
      confirmLabel: '취소하기',
      onConfirm: async () => {
        const { data, error } = await supabase.rpc('ot_admin_cancel', { p_booking_id: booking.id });
        if (error || !data?.ok) {
          showAlert({ message: '취소 실패: ' + (error?.message || data?.reason || '') });
          return;
        }
        try {
          if (data.old_block) await invokeOtBlockGoogleSync('DELETE', null, data.old_block);
        } catch (e) {
          console.warn('[ot] admin cancel calendar delete:', e);
        }
        await fetchAll();
      },
    });
  };

  const isPastSlot = (b) => {
    try {
      return new Date(`${String(b.date).slice(0, 10)}T${b.time}:00+09:00`).getTime() < Date.now();
    } catch {
      return false;
    }
  };

  const usageOf = (link) => {
    const rows = bookingsByLink[link.id] || [];
    const active = rows.filter((b) => b.status === 'confirmed').length;
    const done = rows.filter((b) => b.status === 'completed').length;
    return { active, done, used: active + done };
  };

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <header className="px-6 pt-8 pb-4 flex items-center gap-3 max-w-lg mx-auto">
        <button type="button" onClick={goBack} aria-label="뒤로" className="p-2 -ml-2 text-slate-500 active:text-slate-900">
          <ArrowLeft size={22} strokeWidth={1.5} />
        </button>
        <h1 className="text-lg font-medium tracking-tight">오티 신청 링크</h1>
      </header>

      <main className="px-6 pb-12 max-w-lg mx-auto space-y-6">
        <section className="border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-900 mb-1">새 링크 만들기</p>
          <p className="text-xs text-slate-400 mb-4">
            대상자 이름으로 전용 링크를 만들어 카톡으로 보냅니다. 그 분 화면에는 "이름님, 환영합니다"가 뜨고, 링크 하나당 2회까지 신청됩니다.
          </p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="오티 대상자 이름 (필수)"
            maxLength={30}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-slate-900 focus:border-[#064e3b] outline-none mb-3"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="메모 (선택, 예: 10월 소개)"
            maxLength={40}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-slate-900 focus:border-[#064e3b] outline-none mb-3"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full bg-[#064e3b] text-white font-semibold py-3.5 rounded-xl text-[15px] active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Plus size={18} strokeWidth={1.5} />
            {creating ? '만드는 중…' : '링크 만들고 주소 복사'}
          </button>
        </section>

        {loading ? (
          <p className="text-sm text-slate-400">불러오는 중…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-slate-400">아직 만든 링크가 없습니다.</p>
        ) : (
          links.map((link) => {
            const u = usageOf(link);
            const revoked = Boolean(link.revoked_at);
            return (
              <section key={link.id} className={`border rounded-2xl p-5 ${revoked ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-slate-900 truncate">
                      {link.member_name}님{link.label ? ` · ${link.label}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {revoked ? '폐기됨 · ' : ''}사용 {u.used}/{link.max_sessions}회 · 만든 날 {String(link.created_at).slice(0, 10)}
                    </p>
                  </div>
                  {!revoked && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(link.token)}
                        aria-label="링크 복사"
                        className="p-2.5 rounded-lg text-[#064e3b] active:bg-emerald-50"
                      >
                        <Copy size={18} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(link)}
                        aria-label="링크 폐기"
                        className="p-2.5 rounded-lg text-slate-400 active:bg-gray-100"
                      >
                        <Ban size={18} strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>

                {(bookingsByLink[link.id] || []).length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                    <p className="text-[11px] text-slate-400">
                      완료 처리는 실제 출석을 확인한 뒤 건별로 눌러 주세요. 시간이 지나도 자동으로 완료되지 않습니다(노쇼 정책 미정).
                    </p>
                    {(bookingsByLink[link.id] || []).map((b) => (
                      <div key={b.id} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-slate-700">
                            {String(b.date).slice(0, 10)} {b.time}{' '}
                            <span className={`text-xs ${b.status === 'cancelled' ? 'text-slate-300 line-through' : 'text-slate-400'}`}>
                              {b.status === 'confirmed' ? (isPastSlot(b) ? '신청됨 · 시간 지남' : '신청됨') : b.status === 'completed' ? '완료' : '취소됨'}
                            </span>
                          </p>
                          {b.status === 'confirmed' && (
                            <div className="flex gap-1 shrink-0">
                              {b.block_id && (
                                <button
                                  type="button"
                                  onClick={() => handleCalendarResync(b)}
                                  disabled={syncingId === b.id}
                                  aria-label="캘린더 다시 등록"
                                  className="p-2 rounded-lg text-slate-400 active:bg-gray-100"
                                >
                                  <CalendarPlus size={16} strokeWidth={1.5} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleComplete(b)}
                                aria-label="완료 처리"
                                className="p-2 rounded-lg text-[#064e3b] active:bg-emerald-50"
                              >
                                <CheckCircle2 size={16} strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminCancel(b)}
                                aria-label="신청 취소"
                                className="p-2 rounded-lg text-slate-400 active:bg-gray-100"
                              >
                                <XCircle size={16} strokeWidth={1.5} />
                              </button>
                            </div>
                          )}
                        </div>
                        {b.status === 'confirmed' && (!b.calendar_synced_at || !b.admin_notified_at) && (
                          <p className="text-[11px] text-amber-600">
                            {!b.calendar_synced_at && '캘린더 미등록 — 다시 등록 버튼을 눌러 주세요. '}
                            {!b.admin_notified_at && '관리자 푸시 미확인'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}

        <p className="text-xs text-slate-400 leading-relaxed flex gap-1.5">
          <Link2 size={14} strokeWidth={1.5} className="shrink-0 mt-0.5" />
          같은 사람에게 링크를 여러 개 보내거나 링크가 다른 사람에게 전달되면, 사람당 2회는 보장되지 않습니다. 링크를 잘못 보냈으면 폐기하고 새로 만들어 주세요.
        </p>
      </main>
    </div>
  );
}
