import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import BackButton from '../../components/ui/BackButton';
import { useGlobalModal } from '../../context/GlobalModalContext';
import { MEMBER_ANNOUNCEMENT_QA_PROFILE_NAME } from '../../utils/bookingDateKeys';

const ICON_STROKE = 1.5;

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function AnnouncementEditorModal({ open, initial, onClose, onSaved }) {
  const { showAlert } = useGlobalModal();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setBody(initial?.body ?? '');
    setPublishNow(initial?.is_published ?? !initial?.id);
  }, [open, initial]);

  if (!open) return null;

  const handleSave = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t) {
      showAlert({ message: '제목을 입력해 주세요.' });
      return;
    }
    if (!b) {
      showAlert({ message: '내용을 입력해 주세요.' });
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (initial?.id) {
        const payload = {
          title: t,
          body: b,
          updated_at: now,
        };
        if (publishNow && !initial.is_published) {
          payload.is_published = true;
          payload.published_at = now;
        } else if (!publishNow && initial.is_published) {
          payload.is_published = false;
        }
        const { error } = await supabase
          .from('member_announcements')
          .update(payload)
          .eq('id', initial.id);
        if (error) throw error;
        showAlert({ message: '공지가 수정되었습니다.' });
      } else {
        const { error } = await supabase.from('member_announcements').insert({
          title: t,
          body: b,
          is_published: publishNow,
          published_at: publishNow ? now : null,
        });
        if (error) throw error;
        showAlert({ message: publishNow ? '공지가 게시되었습니다.' : '공지가 저장되었습니다.' });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      console.error('[AnnouncementEditor]', e);
      showAlert({ message: e?.message || '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
            {initial?.id ? '공지 수정' : '공지 게시'}
          </h3>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label htmlFor="ann-title" className="block text-sm font-medium text-neutral-800 mb-2">
              제목
            </label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#064e3b]/40 focus:ring-2 focus:ring-[#064e3b]/15"
              placeholder="공지 제목"
            />
          </div>
          <div>
            <label htmlFor="ann-body" className="block text-sm font-medium text-neutral-800 mb-2">
              내용
            </label>
            <textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-slate-900 leading-relaxed outline-none focus:border-[#064e3b]/40 focus:ring-2 focus:ring-[#064e3b]/15 resize-y min-h-[160px]"
              placeholder="회원에게 전달할 내용을 입력하세요."
            />
          </div>
          {!initial?.id || !initial?.is_published ? (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(e) => setPublishNow(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#064e3b] focus:ring-[#064e3b]/30"
              />
              <span className="text-sm text-gray-700">저장과 동시에 게시</span>
            </label>
          ) : null}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end bg-gray-50/60">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-neutral-950 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중…' : initial?.id ? '저장' : '게시'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMemberAnnouncements({ goBack }) {
  const { showConfirm, showAlert, showToast } = useGlobalModal();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('member_announcements')
        .select('id, title, body, is_published, published_at, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error('[AdminMemberAnnouncements]', e);
      showAlert({ message: e?.message || '목록을 불러오지 못했습니다.' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnpublish = (row) => {
    showConfirm({
      title: '공지 내리기',
      message: '게시를 중단하면 회원 팝업에 더 이상 노출되지 않습니다.',
      confirmLabel: '내리기',
      onConfirm: async (close) => {
        const { error } = await supabase
          .from('member_announcements')
          .update({ is_published: false, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        if (error) throw error;
        close();
        showToast('공지를 내렸습니다.');
        load();
      },
    });
  };

  const handleRepublish = async (row) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('member_announcements')
      .update({ is_published: true, published_at: now, updated_at: now })
      .eq('id', row.id);
    if (error) {
      showAlert({ message: error.message });
      return;
    }
    showToast('공지를 다시 게시했습니다.');
    load();
  };

  const handleDelete = (row) => {
    showConfirm({
      title: '공지 삭제',
      message: `"${row.title}" 공지를 삭제할까요?`,
      confirmLabel: '삭제',
      onConfirm: async (close) => {
        const { error } = await supabase.from('member_announcements').delete().eq('id', row.id);
        if (error) throw error;
        close();
        showToast('삭제되었습니다.');
        load();
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-white text-neutral-950 font-sans">
      <header className="border-b border-neutral-200 px-6 py-8 max-w-3xl mx-auto">
        <BackButton onClick={goBack} />
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">회원 공지</h1>
            <p className="mt-2 text-sm text-neutral-500">
              제목·내용만 게시합니다. 회원 홈 첫 로그인 시 팝업으로 노출됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditor({})}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#064e3b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#053d2f] transition-colors shrink-0"
          >
            <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden />
            공지 게시
          </button>
        </div>
        <p className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-900 leading-relaxed">
          <span className="font-semibold">QA</span> — 현재 팝업은{' '}
          <span className="font-semibold">{MEMBER_ANNOUNCEMENT_QA_PROFILE_NAME}</span> 회원에게만
          노출됩니다.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-sm text-neutral-400">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center">
            <Megaphone className="mx-auto size-8 text-gray-300 mb-3" strokeWidth={ICON_STROKE} />
            <p className="text-sm text-gray-500">등록된 공지가 없습니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 border-t border-b border-neutral-200">
            {rows.map((row) => (
              <li key={row.id} className="py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          row.is_published
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {row.is_published ? '게시 중' : '비게시'}
                      </span>
                      {row.is_published ? (
                        <span className="text-xs text-neutral-400 tabular-nums">
                          게시 {formatDateTime(row.published_at)}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="text-base font-semibold text-slate-900 tracking-tight">{row.title}</h2>
                    <p className="mt-2 text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                      {row.body}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditor(row)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil size={14} strokeWidth={ICON_STROKE} aria-hidden />
                      수정
                    </button>
                    {row.is_published ? (
                      <button
                        type="button"
                        onClick={() => handleUnpublish(row)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        내리기
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRepublish(row)}
                        className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                      >
                        다시 게시
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={14} strokeWidth={ICON_STROKE} aria-hidden />
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnnouncementEditorModal
        open={editor != null}
        initial={editor}
        onClose={() => setEditor(null)}
        onSaved={load}
      />
    </div>
  );
}
