import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Link2, Plus, Copy, Ban, CalendarPlus } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import { invokeOtBlockGoogleSync } from '../../utils/googleCalendarOtSync';

const DEEP_GREEN = '#064e3b';

function linkUrl(token) {
  return `${window.location.origin}/ot/${token}`;
}

/** 오티 1인용 신청 링크 발급·관리 (관리자 전용) */
export default function AdminOtLinks({ goBack }) {
  const { showAlert, showConfirm } = useGlobalModal();
  const [links, setLinks] = useState([]);
  const [bookingsByLink, setBookingsByLink] = useState({});
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
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

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('ot_links')
      .insert({ label: newLabel.trim() || null })
      .select()
      .single();
    setCreating(false);
    if (error) {
      showAlert({ message: '링크 만들기 실패: ' + error.message });
      return;
    }
    setNewLabel('');
    await fetchAll();
    try {
      await navigator.clipboard.writeText(linkUrl(data.token));
      showAlert({ message: '링크를 만들고 주소를 복사했습니다. 카톡으로 붙여넣어 보내면 됩니다.' });
    } catch {
      showAlert({ message: '링크를 만들었습니다. 목록에서 주소를 복사해 보내 주세요.' });
    }
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
    showAlert({
      message: res.ok
        ? '캘린더 등록을 다시 시도했습니다. 캘린더에서 확인해 주세요.'
        : '캘린더 등록에 실패했습니다. 설정을 확인해 주세요.',
    });
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
          <p className="text-xs text-slate-400 mb-4">대상자에게 카톡으로 보낼 1인용 링크를 만듭니다. 링크 하나당 2회까지 신청됩니다.</p>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="메모 (선택, 예: 10월 김OO님)"
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
                      {link.label || '(메모 없음)'}
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
                    {(bookingsByLink[link.id] || []).map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-2">
                        <p className="text-sm text-slate-700">
                          {b.name} · {String(b.date).slice(0, 10)} {b.time}{' '}
                          <span className={`text-xs ${b.status === 'cancelled' ? 'text-slate-300 line-through' : 'text-slate-400'}`}>
                            {b.status === 'confirmed' ? '신청됨' : b.status === 'completed' ? '완료' : '취소됨'}
                          </span>
                        </p>
                        {b.status === 'confirmed' && b.block_id && (
                          <button
                            type="button"
                            onClick={() => handleCalendarResync(b)}
                            disabled={syncingId === b.id}
                            aria-label="캘린더 다시 등록"
                            className="p-2 rounded-lg text-slate-400 active:bg-gray-100 shrink-0"
                          >
                            <CalendarPlus size={16} strokeWidth={1.5} />
                          </button>
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
