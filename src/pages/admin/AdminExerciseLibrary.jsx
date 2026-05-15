import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Dumbbell, Play, PlayCircle, X, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

const EXERCISE_CATEGORIES = ['Exercise', 'Routine'];
const ALL_CATEGORIES = ['All', 'Exercise', 'Routine'];
const BODY_PARTS = ['가슴', '등', '하체', '어깨', '팔', '코어', '전신'];

const MUSCLE_SLUGS = [
  { slug: 'chest',      label: '가슴 (Chest)' },
  { slug: 'abs',        label: '복근 (Abs)' },
  { slug: 'obliques',   label: '옆구리 (Obliques)' },
  { slug: 'biceps',     label: '이두 (Biceps)' },
  { slug: 'triceps',    label: '삼두 (Triceps)' },
  { slug: 'forearm',    label: '전완 (Forearm)' },
  { slug: 'deltoids',   label: '어깨 (Deltoids)' },
  { slug: 'trapezius',  label: '승모근 (Trapezius)' },
  { slug: 'upper-back', label: '등 상부 (Upper Back)' },
  { slug: 'lower-back', label: '등 하부 (Lower Back)' },
  { slug: 'quadriceps', label: '대퇴사두 (Quadriceps)' },
  { slug: 'hamstring',  label: '햄스트링 (Hamstring)' },
  { slug: 'gluteal',    label: '둔근 (Glutes)' },
  { slug: 'calves',     label: '종아리 (Calves)' },
  { slug: 'adductors',  label: '내전근 (Adductors)' },
];

const CATEGORY_LABEL = { Exercise: '운동', Routine: '루틴' };

const AdminExerciseLibrary = ({ goBack }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'Exercise', body_part: '', target_muscle: '', image_url: '', video_url: '' });
  const [selectedPost, setSelectedPost] = useState(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .in('category', EXERCISE_CATEGORIES)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (e) {
      console.error('[AdminExerciseLibrary] fetch:', e);
      toast.error('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const filtered = filter === 'All' ? posts : posts.filter((p) => p.category === filter);

  const resetForm = () => setForm({ title: '', content: '', category: 'Exercise', body_part: '', target_muscle: '', image_url: '', video_url: '' });

  const openEdit = (post) => {
    setForm({
      title: post.title || '',
      content: post.content || '',
      category: post.category || 'Exercise',
      body_part: post.body_part || '',
      target_muscle: post.target_muscle || '',
      image_url: post.image_url || '',
      video_url: post.video_url || '',
    });
    setEditingPost(post);
  };

  const closeEdit = () => {
    setEditingPost(null);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('제목과 내용을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        body_part: form.body_part || null,
        target_muscle: form.target_muscle || null,
        image_url: form.image_url.trim() || null,
        video_url: form.video_url.trim() || null,
      };
      const { error } = await supabase.from('posts').update(payload).eq('id', editingPost.id);
      if (error) throw error;
      // Update local state immediately — no refetch needed
      setPosts((prev) => prev.map((p) => p.id === editingPost.id ? { ...p, ...payload } : p));
      toast.success('수정 완료.');
      closeEdit();
    } catch (e) {
      console.error('[AdminExerciseLibrary] update:', e);
      toast.error('수정 실패: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('제목과 내용을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        body_part: form.body_part || null,
        target_muscle: form.target_muscle || null,
        image_url: form.image_url.trim() || null,
        video_url: form.video_url.trim() || null,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('posts').insert([payload]);
      if (error) throw error;
      toast.success('저장되었습니다.');
      setShowModal(false);
      resetForm();
      await fetchPosts();
    } catch (e) {
      console.error('[AdminExerciseLibrary] save:', e);
      toast.error('저장 실패: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
          aria-label="뒤로"
        >
          <ArrowLeft size={20} strokeWidth={1.5} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">운동 라이브러리</h1>
          <p className="text-[10px] text-gray-400 uppercase tracking-[0.15em]">Exercise Library</p>
        </div>
        <button
          type="button"
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-1.5 rounded-xl bg-[#064e3b] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
        >
          <Plus size={14} strokeWidth={2} />
          새 콘텐츠
        </button>
      </header>

      {/* Filter pills */}
      <div className="px-5 pt-4 pb-2 flex gap-2">
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === cat
                ? 'bg-[#064e3b] text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-emerald-500/40'
            }`}
          >
            {cat === 'All' ? '전체' : CATEGORY_LABEL[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Content list */}
      <main className="flex-1 px-5 pt-3 pb-24">
        {loading ? (
          <div className="flex justify-center pt-16">
            <p className="text-sm text-gray-400 tracking-wide">Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-3 text-gray-400">
            <Dumbbell size={36} strokeWidth={1} />
            <p className="text-sm">등록된 콘텐츠가 없습니다.</p>
            <button
              type="button"
              onClick={() => { resetForm(); setShowModal(true); }}
              className="mt-2 rounded-xl border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 transition"
            >
              첫 번째 콘텐츠 추가하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition hover:border-emerald-500/30"
              >
                {post.image_url && !post.video_url && (
                  <img src={post.image_url} alt={post.title} className="w-full h-36 object-cover" />
                )}
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  {/* Clickable text area → detail modal */}
                  <button
                    type="button"
                    onClick={() => setSelectedPost(post)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
                        {CATEGORY_LABEL[post.category] ?? post.category}
                      </span>
                      {post.body_part && (
                        <span className="text-[10px] text-gray-500 border border-gray-200 rounded-full px-1.5 py-0.5">
                          {post.body_part}
                        </span>
                      )}
                      {post.video_url && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                          <PlayCircle size={10} />
                          Video
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">{post.title}</h3>
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">{post.content}</p>
                  </button>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <button
                      type="button"
                      onClick={() => openEdit(post)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                      aria-label="수정"
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <Play size={14} strokeWidth={1.5} className="text-gray-200 ml-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Write Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-slate-900">새 운동 콘텐츠</h2>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition"
                placeholder="제목"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="Exercise">운동 (Exercise)</option>
                <option value="Routine">루틴 (Routine)</option>
              </select>
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none"
                value={form.body_part}
                onChange={(e) => setForm({ ...form, body_part: e.target.value })}
              >
                <option value="">부위 선택 (선택사항)</option>
                {BODY_PARTS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none"
                value={form.target_muscle}
                onChange={(e) => setForm({ ...form, target_muscle: e.target.value })}
              >
                <option value="">주 타겟 근육 (선택사항)</option>
                {MUSCLE_SLUGS.map(({ slug, label }) => (
                  <option key={slug} value={slug}>{label}</option>
                ))}
              </select>
              <textarea
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition resize-none h-28"
                placeholder="내용 / 설명"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition"
                placeholder="이미지 URL (선택사항)"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
              <div>
                <input
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition"
                  placeholder="동영상 URL (선택사항)"
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-gray-400">짧은 길이의 MP4 직접 링크를 권장합니다. (소리 없이 자동 반복됩니다)</p>
                {form.video_url.trim() && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-black max-w-sm">
                    <video
                      src={form.video_url.trim()}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-auto object-cover opacity-90"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[#064e3b] px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">운동 수정</h2>
                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{editingPost.title}</p>
              </div>
              <button type="button" onClick={closeEdit} className="rounded-lg p-1 hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition"
                placeholder="제목"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="Exercise">운동 (Exercise)</option>
                <option value="Routine">루틴 (Routine)</option>
              </select>
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none"
                value={form.body_part}
                onChange={(e) => setForm({ ...form, body_part: e.target.value })}
              >
                <option value="">부위 선택 (선택사항)</option>
                {BODY_PARTS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none"
                value={form.target_muscle}
                onChange={(e) => setForm({ ...form, target_muscle: e.target.value })}
              >
                <option value="">주 타겟 근육 (선택사항)</option>
                {MUSCLE_SLUGS.map(({ slug, label }) => (
                  <option key={slug} value={slug}>{label}</option>
                ))}
              </select>
              <textarea
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition resize-none h-28"
                placeholder="내용 / 설명"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition"
                placeholder="이미지 URL (선택사항)"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
              <div>
                <input
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition"
                  placeholder="동영상 URL (선택사항)"
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-gray-400">짧은 길이의 MP4 직접 링크를 권장합니다. (소리 없이 자동 반복됩니다)</p>
                {form.video_url.trim() && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-black max-w-sm">
                    <video
                      src={form.video_url.trim()}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-auto object-cover opacity-90"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={saving}
                className="rounded-xl bg-[#064e3b] px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {saving ? '저장 중…' : '수정 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
                {CATEGORY_LABEL[selectedPost.category] ?? selectedPost.category}
              </span>
              <button type="button" onClick={() => setSelectedPost(null)} className="rounded-lg p-1 hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {selectedPost.video_url && (
                <video
                  src={selectedPost.video_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-52 object-cover bg-black"
                />
              )}
              {!selectedPost.video_url && selectedPost.image_url && (
                <img src={selectedPost.image_url} alt={selectedPost.title} className="w-full h-52 object-cover" />
              )}
              <div className="p-5">
                <h2 className="text-base font-semibold text-slate-900">{selectedPost.title}</h2>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminExerciseLibrary;
