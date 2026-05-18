import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Dumbbell, PlayCircle, X, Pencil, Trash2, Tag } from 'lucide-react';
import Body from 'react-muscle-highlighter';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

// ── Constants ──────────────────────────────────────────────────────────────────

/** White Lab: crimson = primary target, emerald = synergist */
const HL_PRIMARY = '#dc2626';
const HL_SECONDARY = '#16a34a';
const HL_SECONDARY_LIGHT = '#86efac';
const BODY_HIGHLIGHT_PALETTE = [HL_PRIMARY, HL_SECONDARY, HL_SECONDARY_LIGHT];

/** Strip legacy `side` view; member detail only uses front/back SVGs from the library. */
const sanitizeActiveViews = (views) => {
  const allowed = new Set(['front', 'back']);
  const out = (Array.isArray(views) ? views : [])
    .filter((v) => allowed.has(v));
  return out.length > 0 ? [...new Set(out)] : ['front'];
};

/**
 * Map react-muscle-highlighter body tap (slug) + plane → micro-segment id.
 * Front shoulder → lateral delt; back shoulder → rear delt; back glute → medius; etc.
 */
const BODY_PRESS_ID_BY_VIEW = {
  front: {
    deltoids: 'side_delts',
    chest: 'chest',
    biceps: 'biceps',
    triceps: 'triceps',
    forearm: 'forearm',
    abs: 'abs',
    obliques: 'obliques',
    quadriceps: 'quads_vastus',
    adductors: 'adductors',
    tibialis: 'tibialis',
    calves: 'calves',
    gluteal: 'gluteal',
    hamstring: 'hams',
    'upper-back': 'lats',
    trapezius: 'traps_mid',
    'lower-back': 'erector_spinae',
  },
  back: {
    deltoids: 'rear_delts',
    'upper-back': 'lats',
    trapezius: 'traps_mid',
    'lower-back': 'erector_spinae',
    triceps: 'triceps',
    biceps: 'biceps',
    forearm: 'forearm',
    gluteal: 'gluteus_medius',
    hamstring: 'hams',
    calves: 'calves',
    quadriceps: 'quads',
    obliques: 'obliques',
    abs: 'abs',
    adductors: 'adductors',
    tibialis: 'tibialis',
    chest: 'chest',
  },
};

const EXERCISE_CATEGORIES = ['Exercise', 'Routine'];
const CATEGORY_LABEL = { Exercise: '운동', Routine: '루틴' };

// Scientific micro-segmentation: each entry has a unique id (stored in DB),
// a library slug (for react-muscle-highlighter visualisation), and display info.
const MUSCLE_GROUPS = [
  {
    group: '가슴',
    muscles: [
      { id: 'chest',       slug: 'chest', label: '가슴 전체',    preferredView: 'front' },
      { id: 'chest_upper', slug: 'chest', label: '상부 가슴',    preferredView: 'front' },
      { id: 'chest_mid',   slug: 'chest', label: '중부 가슴',    preferredView: 'front' },
      { id: 'chest_lower', slug: 'chest', label: '하부 가슴',    preferredView: 'front' },
    ],
  },
  {
    group: '등',
    muscles: [
      { id: 'lats',           slug: 'upper-back', label: '광배근',       preferredView: 'back' },
      { id: 'rhomboids',      slug: 'upper-back', label: '능형근',       preferredView: 'back' },
      { id: 'traps_upper',    slug: 'trapezius',  label: '승모근 상부',  preferredView: 'back' },
      { id: 'traps_mid',      slug: 'trapezius',  label: '승모근 중부',  preferredView: 'back' },
      { id: 'traps_lower',    slug: 'trapezius',  label: '승모근 하부',  preferredView: 'back' },
      { id: 'erector_spinae', slug: 'lower-back', label: '척추기립근',  preferredView: 'back' },
      { id: 'lower_back',     slug: 'lower-back', label: '요방형근',    preferredView: 'back' },
    ],
  },
  {
    group: '어깨',
    muscles: [
      { id: 'front_delts', slug: 'deltoids', label: '전면 삼각근', preferredView: 'front' },
      { id: 'side_delts',  slug: 'deltoids', label: '측면 삼각근', preferredView: 'front' },
      { id: 'rear_delts',  slug: 'deltoids', label: '후면 삼각근', preferredView: 'back'  },
    ],
  },
  {
    group: '팔',
    muscles: [
      { id: 'biceps',     slug: 'biceps',  label: '이두근',               preferredView: 'front' },
      { id: 'brachialis', slug: 'biceps',  label: '상완이두근',           preferredView: 'front' },
      { id: 'triceps',    slug: 'triceps', label: '삼두근',               preferredView: 'back'  },
      { id: 'forearm',    slug: 'forearm', label: '전완근',               preferredView: 'front' },
    ],
  },
  {
    group: '코어',
    muscles: [
      { id: 'abs',      slug: 'abs',      label: '복직근',               preferredView: 'front' },
      { id: 'obliques', slug: 'obliques', label: '외복사근',             preferredView: 'front' },
      { id: 'serratus', slug: 'obliques', label: '전거근',                preferredView: 'front' },
    ],
  },
  {
    group: '하체',
    muscles: [
      { id: 'quads',          slug: 'quadriceps', label: '대퇴사두 전체',          preferredView: 'front' },
      { id: 'quads_vastus',   slug: 'quadriceps', label: '대퇴외측광근',          preferredView: 'front' },
      { id: 'quads_rectus',   slug: 'quadriceps', label: '대퇴직근',              preferredView: 'front' },
      { id: 'tfl',            slug: 'quadriceps', label: '대퇴근막장근',          preferredView: 'front' },
      { id: 'hams',           slug: 'hamstring',  label: '뒷허벅지근 전체',       preferredView: 'back'  },
      { id: 'hams_inner',     slug: 'hamstring',  label: '뒷허벅지 내측',         preferredView: 'back'  },
      { id: 'hams_outer',     slug: 'hamstring',  label: '뒷허벅지 외측',         preferredView: 'back'  },
      { id: 'gluteal',        slug: 'gluteal',    label: '대둔근',                  preferredView: 'back'  },
      { id: 'gluteus_medius', slug: 'gluteal',    label: '중둔근',                  preferredView: 'back'  },
      { id: 'adductors',      slug: 'adductors',  label: '내전근',                 preferredView: 'front' },
      { id: 'calves',         slug: 'calves',     label: '복사두근(종아리)',        preferredView: 'back'  },
      { id: 'fibularis',      slug: 'calves',     label: '비골근',                 preferredView: 'back'  },
      { id: 'tibialis',       slug: 'tibialis',   label: '전경골근',               preferredView: 'front' },
    ],
  },
];

// Flat lookup: id → muscle definition
const MUSCLE_BY_ID = {};
MUSCLE_GROUPS.forEach(({ muscles }) => muscles.forEach((m) => { MUSCLE_BY_ID[m.id] = m; }));

const toLibrarySlug = (id) => MUSCLE_BY_ID[id]?.slug ?? id;
const toLabel       = (id) => MUSCLE_BY_ID[id]?.label ?? id;

const PLANE_VIEWS = [
  { val: 'front', label: '전면' },
  { val: 'back',  label: '후면' },
];

const EMPTY_FORM = {
  title: '', content: '', category: 'Exercise',
  body_part: '', target_muscles: [],
  active_views: ['front'],
  image_url: '', video_url: '',
};

// ── Muscle Picker Panel ───────────────────────────────────────────────────────

const MusclePickerPanel = ({ selectedMuscles, onChange }) => {
  const [pickerView, setPickerView] = useState('front');

  const bodyData = useMemo(
    () => selectedMuscles.map((id, idx) => ({
      slug: toLibrarySlug(id),
      color: idx === 0 ? HL_PRIMARY : idx % 2 === 1 ? HL_SECONDARY : HL_SECONDARY_LIGHT,
    })),
    [selectedMuscles]
  );

  const toggleMuscle = (id) => {
    if (selectedMuscles.includes(id)) {
      onChange(selectedMuscles.filter((m) => m !== id));
    } else {
      onChange([...selectedMuscles, id]);
    }
  };

  const resolveBodyPressId = (slug) => {
    const mapped = BODY_PRESS_ID_BY_VIEW[pickerView]?.[slug];
    if (mapped) return mapped;
    const samePlane = MUSCLE_GROUPS.flatMap((g) => g.muscles).filter(
      (m) => m.slug === slug && m.preferredView === pickerView
    );
    if (samePlane[0]) return samePlane[0].id;
    const any = MUSCLE_GROUPS.flatMap((g) => g.muscles).filter((m) => m.slug === slug);
    return any[0]?.id ?? slug;
  };

  const handleBodyPress = (part) => {
    if (part?.slug) toggleMuscle(resolveBodyPressId(part.slug));
  };

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-white">
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.18em]">타깃 근육</p>
          <p className="text-xs font-semibold text-zinc-800 mt-0.5">인체 도를 누르거나 아래에서 근육을 선택하세요</p>
        </div>
        {selectedMuscles.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            초기화
          </button>
        )}
      </div>

      {/* View switcher — front / back only (library SVGs) */}
      <div className="flex gap-1 px-3 pt-3 pb-1 bg-[#F8F9FA]">
        {PLANE_VIEWS.map(({ val, label }) => (
          <button
            key={val}
            type="button"
            onClick={() => setPickerView(val)}
            className={`flex-1 py-2.5 text-sm font-bold tracking-wide rounded-lg transition-all leading-tight ${
              pickerView === val
                ? 'bg-[#064e3b] text-white shadow-sm'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:border-emerald-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Interactive body map — clinical panel */}
      <div className="flex justify-center py-4 bg-[#F8F9FA] border-b border-zinc-100">
        <div className="rounded-2xl bg-white border border-zinc-100 shadow-inner p-2 w-full max-w-[280px] flex justify-center">
          <Body
            data={bodyData}
            side={pickerView}
            gender="male"
            scale={0.75}
            border="none"
            defaultFill="#e5e7eb"
            defaultStroke="#d1d5db"
            defaultStrokeWidth={0.5}
            colors={BODY_HIGHLIGHT_PALETTE}
            onBodyPartPress={handleBodyPress}
          />
        </div>
      </div>

      {/* Selected muscle chips */}
      {selectedMuscles.length > 0 && (
        <div className="px-3 py-2.5 flex flex-wrap gap-1.5 bg-white border-b border-zinc-100">
          {selectedMuscles.map((id, idx) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleMuscle(id)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-all active:scale-95 ${
                idx === 0
                  ? 'bg-red-700 text-white text-[10px] font-bold tracking-wide shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold'
              }`}
            >
              {idx === 0 && <span className="text-[7px] opacity-80 mr-0.5">◉ 주동</span>}
              {toLabel(id)}
              <X size={9} strokeWidth={2.5} />
            </button>
          ))}
        </div>
      )}

      {/* Muscle group chips */}
      <div className="bg-white px-3 py-3 space-y-3 max-h-52 overflow-y-auto">
        {MUSCLE_GROUPS.map(({ group, muscles }) => (
          <div key={group}>
            <p className="text-[9px] font-bold text-zinc-500 tracking-wide mb-1.5">{group}</p>
            <div className="flex flex-wrap gap-1.5">
              {muscles.map(({ id, label }) => {
                const selected = selectedMuscles.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleMuscle(id)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all active:scale-95 ${
                      selected
                        ? 'bg-[#064e3b] text-white shadow-sm'
                        : 'bg-zinc-50 border border-zinc-200 text-zinc-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Shared form fields ─────────────────────────────────────────────────────────

const FormFields = ({ form, setForm, dynamicCategories }) => {
  const toggleView = (val) => {
    const next = form.active_views.includes(val)
      ? form.active_views.filter((v) => v !== val)
      : [...form.active_views, val];
    setForm({ ...form, active_views: next.length > 0 ? next : ['front'] });
  };

  return (
    <div className="space-y-3">
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
        <option value="Exercise">운동</option>
        <option value="Routine">루틴</option>
      </select>

      <select
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none"
        value={form.body_part}
        onChange={(e) => setForm({ ...form, body_part: e.target.value })}
      >
        <option value="">부위 선택 (선택사항)</option>
        {dynamicCategories.map((c) => (
          <option key={c.id} value={c.label}>{c.label}</option>
        ))}
      </select>

      {/* ── Scientific Multi-Select Muscle Picker ── */}
      <MusclePickerPanel
        selectedMuscles={form.target_muscles}
        onChange={(muscles) => setForm({ ...form, target_muscles: muscles })}
      />

      {/* ── Active anatomy views for member detail ── */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
        <p className="text-[11px] font-semibold text-gray-600 mb-2.5">
          회원 화면에 표시할 해부도
        </p>
        <div className="flex gap-5">
          {PLANE_VIEWS.map(({ val, label }) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.active_views.includes(val)}
                onChange={() => toggleView(val)}
                className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
              />
              <span className="text-sm text-slate-700 font-medium">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <textarea
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition resize-none h-28"
        placeholder="내용 / 설명"
        value={form.content}
        onChange={(e) => setForm({ ...form, content: e.target.value })}
      />
      <input
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition"
        placeholder="이미지 주소 (선택)"
        value={form.image_url}
        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
      />
      <div>
        <input
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition"
          placeholder="동영상 주소 (선택)"
          value={form.video_url}
          onChange={(e) => setForm({ ...form, video_url: e.target.value })}
        />
        <p className="mt-1 text-[11px] text-gray-400">짧은 동영상의 직접 링크를 넣어 주세요. 재생 시 소리는 나지 않고 자동으로 반복됩니다.</p>
        {form.video_url.trim() && (
          <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-black max-w-sm">
            <video src={form.video_url.trim()} autoPlay loop muted playsInline className="w-full h-auto opacity-90" />
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const AdminExerciseLibrary = ({ goBack }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const [categories, setCategories] = useState([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deletingCategoryBusy, setDeletingCategoryBusy] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [deletingPost, setDeletingPost] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedPost, setSelectedPost] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('exercise_categories')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setCategories(data || []);
  }, []);

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
    fetchCategories();
    fetchPosts();
  }, [fetchCategories, fetchPosts]);

  // ── Category CRUD ──────────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    const label = newCategoryLabel.trim();
    if (!label) return;
    if (categories.some((c) => c.label === label)) {
      toast.error('이미 존재하는 카테고리입니다.');
      return;
    }
    setAddingCategory(true);
    try {
      const { data, error } = await supabase
        .from('exercise_categories')
        .insert([{ label }])
        .select()
        .single();
      if (error) throw error;
      setCategories((prev) => [...prev, data]);
      setNewCategoryLabel('');
      toast.success(`"${label}" 카테고리가 추가되었습니다.`);
    } catch (e) {
      toast.error('추가 실패: ' + (e.message || String(e)));
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const usedCount = posts.filter((p) => p.body_part === cat.label).length;
    if (usedCount > 0) {
      toast.error(`"${cat.label}"에 운동이 ${usedCount}개 있어 삭제할 수 없습니다.`);
      return;
    }
    setDeletingCategoryBusy(true);
    try {
      const { error } = await supabase
        .from('exercise_categories')
        .delete()
        .eq('id', cat.id);
      if (error) throw error;
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setDeletingCategory(null);
      toast.success(`"${cat.label}" 삭제 완료.`);
    } catch (e) {
      toast.error('삭제 실패: ' + (e.message || String(e)));
    } finally {
      setDeletingCategoryBusy(false);
    }
  };

  // ── Post CRUD ──────────────────────────────────────────────────────────────

  const buildPayload = () => {
    const muscles = form.target_muscles ?? [];
    const primarySlug = muscles.length > 0 ? toLibrarySlug(muscles[0]) : null;
    return {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      body_part: form.body_part || null,
      target_muscles: muscles.length > 0 ? muscles : null,
      target_muscle: primarySlug, // backward-compat for member display
      active_views: sanitizeActiveViews(form.active_views),
      image_url: form.image_url.trim() || null,
      video_url: form.video_url.trim() || null,
    };
  };

  // Strip target_muscles from payload and retry when the DB column hasn't been
  // migrated yet (PostgREST returns "could not find the 'target_muscles' column").
  const saveWithFallback = async (operation) => {
    const { error } = await operation(buildPayload());
    if (!error) return null;
    if (error.message?.toLowerCase().includes('target_muscles')) {
      const { target_muscles: _tm, ...fallback } = buildPayload();
      const { error: err2 } = await operation(fallback);
      if (!err2) {
        toast('target_muscles 컬럼이 없어 기본 저장했습니다. Supabase 대시보드에서 마이그레이션을 실행해 주세요.', { icon: '⚠️' });
        return null;
      }
      return err2;
    }
    return error;
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('제목과 내용을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const err = await saveWithFallback((payload) =>
        supabase.from('posts').insert([{ ...payload, created_at: new Date().toISOString() }])
      );
      if (err) throw err;
      toast.success('저장되었습니다.');
      setShowModal(false);
      setForm(EMPTY_FORM);
      await fetchPosts();
    } catch (e) {
      toast.error('저장 실패: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (post) => {
    const muscles =
      Array.isArray(post.target_muscles) && post.target_muscles.length > 0
        ? post.target_muscles
        : post.target_muscle
        ? [post.target_muscle]
        : [];
    setForm({
      title: post.title || '',
      content: post.content || '',
      category: post.category || 'Exercise',
      body_part: post.body_part || '',
      target_muscles: muscles,
      active_views: sanitizeActiveViews(
        Array.isArray(post.active_views) && post.active_views.length > 0
          ? post.active_views
          : ['front']
      ),
      image_url: post.image_url || '',
      video_url: post.video_url || '',
    });
    setEditingPost(post);
  };

  const handleUpdate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('제목과 내용을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const err = await saveWithFallback((payload) =>
        supabase.from('posts').update(payload).eq('id', editingPost.id)
      );
      if (err) throw err;
      const saved = buildPayload();
      setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? { ...p, ...saved } : p)));
      toast.success('수정 완료.');
      setEditingPost(null);
      setForm(EMPTY_FORM);
    } catch (e) {
      toast.error('수정 실패: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPost) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', deletingPost.id);
      if (error) throw error;
      setPosts((prev) => prev.filter((p) => p.id !== deletingPost.id));
      toast.success('삭제되었습니다.');
      setDeletingPost(null);
    } catch (e) {
      toast.error('삭제 실패: ' + (e.message || String(e)));
    } finally {
      setDeleting(false);
    }
  };

  const viewLabel = (v) => (v === 'front' ? '전면' : '후면');

  const filtered = filter === 'All' ? posts : posts.filter((p) => p.category === filter);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] text-slate-900 flex flex-col font-sans">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-zinc-100 px-4 py-3 flex items-center gap-2 shadow-sm">
        <button type="button" onClick={goBack} className="rounded-lg p-1.5 hover:bg-zinc-100 transition-colors" aria-label="뒤로">
          <ArrowLeft size={20} strokeWidth={1.5} className="text-zinc-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">운동 라이브러리</h1>
          <p className="text-[10px] text-zinc-400 mt-0.5 tracking-wide">운동·루틴 모음</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCategoryManager(true)}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 active:scale-95"
        >
          <Tag size={13} strokeWidth={1.5} />
          카테고리
        </button>
        <button
          type="button"
          onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
          className="flex items-center gap-1.5 rounded-xl bg-[#064e3b] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
        >
          <Plus size={14} strokeWidth={2} />
          새 콘텐츠
        </button>
      </header>

      {/* Filter pills */}
      <div className="px-5 pt-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {[{ val: 'All', label: '전체' }, { val: 'Exercise', label: '운동' }, { val: 'Routine', label: '루틴' }].map(({ val, label }) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilter(val)}
            className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              filter === val
                ? 'bg-[#064e3b] text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-emerald-500/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content list */}
      <main className="flex-1 px-5 pt-3 pb-24">
        {loading ? (
          <div className="flex justify-center pt-16">
            <p className="text-sm text-zinc-400 tracking-wide">불러오는 중…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-3 text-zinc-400">
            <Dumbbell size={36} strokeWidth={1} />
            <p className="text-sm">등록된 콘텐츠가 없습니다.</p>
            <button
              type="button"
              onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
              className="mt-2 rounded-xl border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 transition"
            >
              첫 번째 콘텐츠 추가하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((post) => {
              const muscles =
                Array.isArray(post.target_muscles) && post.target_muscles.length > 0
                  ? post.target_muscles
                  : post.target_muscle
                  ? [post.target_muscle]
                  : [];
              return (
                <div key={post.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden transition hover:border-emerald-500/30">
                  {post.image_url && !post.video_url && (
                    <img src={post.image_url} alt={post.title} className="w-full h-36 object-cover" />
                  )}
                  <div className="px-4 py-3 flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setSelectedPost(post)} className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold tracking-wide text-emerald-700">
                          {CATEGORY_LABEL[post.category] ?? post.category}
                        </span>
                        {post.body_part && (
                          <span className="text-[10px] text-zinc-500 border border-zinc-200 rounded-full px-1.5 py-0.5">{post.body_part}</span>
                        )}
                        {/* active_views badges */}
                        {sanitizeActiveViews(post.active_views).map((v) => (
                          <span key={v} className="text-[10px] text-blue-500 bg-blue-50 border border-blue-100 rounded-full px-1.5 py-0.5">
                            {viewLabel(v)}
                          </span>
                        ))}
                        {post.video_url && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                            <PlayCircle size={10} /> 동영상
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">{post.title}</h3>
                      {/* Muscle tags */}
                      {muscles.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {muscles.slice(0, 3).map((id, idx) => (
                            <span
                              key={id}
                              className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                                idx === 0
                                  ? 'bg-red-50 text-red-800 border border-red-100'
                                  : 'bg-zinc-50 text-zinc-500 border border-zinc-100'
                              }`}
                            >
                              {toLabel(id)}
                            </span>
                          ))}
                          {muscles.length > 3 && (
                            <span className="text-[10px] text-zinc-400">+{muscles.length - 3}</span>
                          )}
                        </div>
                      )}
                      <p className="mt-0.5 text-xs text-zinc-500 line-clamp-1 leading-relaxed">{post.content}</p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button type="button" onClick={() => openEdit(post)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors" aria-label="수정">
                        <Pencil size={14} strokeWidth={1.5} />
                      </button>
                      <button type="button" onClick={() => setDeletingPost(post)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors" aria-label="삭제">
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Category Manager Modal ── */}
      {showCategoryManager && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">카테고리 관리</h2>
                <p className="text-[10px] text-zinc-400 mt-0.5">운동 부위 카테고리를 추가하거나 삭제합니다.</p>
              </div>
              <button type="button" onClick={() => setShowCategoryManager(false)} className="rounded-lg p-1 hover:bg-zinc-100">
                <X size={18} className="text-zinc-500" />
              </button>
            </div>
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2 mb-4">
                {categories.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-4">카테고리가 없습니다.</p>
                ) : categories.map((cat) => {
                  const usedCount = posts.filter((p) => p.body_part === cat.label).length;
                  return (
                    <div key={cat.id} className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 rounded-xl border border-zinc-100">
                      <div>
                        <span className="text-sm font-medium text-slate-900">{cat.label}</span>
                        {usedCount > 0 && (
                          <span className="ml-2 text-[10px] text-zinc-400">{usedCount}개 운동 사용 중</span>
                        )}
                      </div>
                      {deletingCategory?.id === cat.id ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            disabled={deletingCategoryBusy}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50"
                          >
                            {deletingCategoryBusy ? '…' : '확인'}
                          </button>
                          <button type="button" onClick={() => setDeletingCategory(null)} className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 transition">
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingCategory(cat)}
                          disabled={usedCount > 0}
                          className="rounded-lg p-1.5 text-zinc-300 hover:text-red-400 hover:bg-red-50 transition disabled:cursor-not-allowed disabled:opacity-40"
                          title={usedCount > 0 ? '운동이 있어 삭제 불가' : '삭제'}
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 transition"
                  placeholder="새 카테고리 이름"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={addingCategory || !newCategoryLabel.trim()}
                  className="rounded-xl bg-[#064e3b] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-40"
                >
                  {addingCategory ? '…' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Write Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100">
              <h2 className="text-base font-semibold text-slate-900">새 운동 콘텐츠</h2>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-zinc-100">
                <X size={18} className="text-zinc-500" />
              </button>
            </div>
            <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
              <FormFields form={form} setForm={setForm} dynamicCategories={categories} />
            </div>
            <div className="px-5 py-4 flex justify-end gap-2 border-t border-zinc-100">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition">취소</button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded-xl bg-[#064e3b] px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50">
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">운동 수정</h2>
                <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{editingPost.title}</p>
              </div>
              <button type="button" onClick={() => { setEditingPost(null); setForm(EMPTY_FORM); }} className="rounded-lg p-1 hover:bg-zinc-100">
                <X size={18} className="text-zinc-500" />
              </button>
            </div>
            <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
              <FormFields form={form} setForm={setForm} dynamicCategories={categories} />
            </div>
            <div className="px-5 py-4 flex justify-end gap-2 border-t border-zinc-100">
              <button type="button" onClick={() => { setEditingPost(null); setForm(EMPTY_FORM); }} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition">취소</button>
              <button type="button" onClick={handleUpdate} disabled={saving} className="rounded-xl bg-[#064e3b] px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50">
                {saving ? '저장 중…' : '수정 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deletingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
            <div className="px-6 pt-6 pb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <Trash2 size={20} className="text-red-500" strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-1">게시물 삭제</h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                <span className="font-semibold text-slate-700">"{deletingPost.title}"</span>을(를) 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button type="button" onClick={() => setDeletingPost(null)} disabled={deleting} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition disabled:opacity-50">취소</button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition disabled:opacity-50">
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post Detail Modal ── */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-100 shrink-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
                  {CATEGORY_LABEL[selectedPost.category] ?? selectedPost.category}
                </span>
                {selectedPost.body_part && (
                  <span className="text-[10px] text-zinc-500 border border-zinc-200 rounded-full px-2 py-0.5">{selectedPost.body_part}</span>
                )}
              </div>
              <button type="button" onClick={() => setSelectedPost(null)} className="rounded-lg p-1 hover:bg-zinc-100">
                <X size={18} className="text-zinc-400" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {selectedPost.video_url && (
                <div className="w-full bg-black">
                  <video src={selectedPost.video_url} autoPlay loop muted playsInline className="w-full h-auto object-contain" />
                </div>
              )}
              {!selectedPost.video_url && selectedPost.image_url && (
                <img src={selectedPost.image_url} alt={selectedPost.title} className="w-full h-auto object-cover" />
              )}
              <div className="p-5">
                <h2 className="text-base font-semibold text-slate-900">{selectedPost.title}</h2>
                <p className="mt-3 text-sm text-zinc-500 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                {sanitizeActiveViews(selectedPost.active_views).length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {sanitizeActiveViews(selectedPost.active_views).map((v) => (
                      <span key={v} className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                        {viewLabel(v)} 표시
                      </span>
                    ))}
                  </div>
                )}
                {(() => {
                  const muscles =
                    Array.isArray(selectedPost.target_muscles) && selectedPost.target_muscles.length > 0
                      ? selectedPost.target_muscles
                      : selectedPost.target_muscle
                      ? [selectedPost.target_muscle]
                      : [];
                  if (muscles.length === 0) return null;
                  return (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {muscles.map((id, idx) => (
                        <span
                          key={id}
                          className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${
                            idx === 0
                              ? 'bg-red-700 text-white'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}
                        >
                          {toLabel(id)}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminExerciseLibrary;
