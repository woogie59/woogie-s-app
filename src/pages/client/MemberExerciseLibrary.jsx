import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Dumbbell } from 'lucide-react';
import Body from 'react-muscle-highlighter';
import { supabase } from '../../lib/supabaseClient';
import SideBodyView from '../../components/SideBodyView';

// ── Constants ──────────────────────────────────────────────────────────────────

const EXERCISE_CATEGORIES = ['Exercise', 'Routine'];
const CATEGORY_LABEL = { Exercise: '운동', Routine: '루틴' };
const DEFAULT_BODY_PARTS = ['가슴', '등', '하체', '어깨', '팔', '코어', '전신'];

const BODY_PART_META = {
  '가슴': { slug: 'chest',      side: 'front' },
  '등':   { slug: 'upper-back', side: 'back'  },
  '하체': { slug: 'quadriceps', side: 'front' },
  '어깨': { slug: 'deltoids',   side: 'front' },
  '팔':   { slug: 'biceps',     side: 'front' },
  '코어': { slug: 'abs',        side: 'front' },
  '전신': { slug: null,         side: 'front' },
};

// Micro-segment ID → library slug mapping (mirrors AdminExerciseLibrary)
const MUSCLE_ID_TO_SLUG = {
  chest: 'chest', chest_upper: 'chest', chest_mid: 'chest', chest_lower: 'chest',
  lats: 'upper-back', rhomboids: 'upper-back',
  traps_upper: 'trapezius', traps_mid: 'trapezius', traps_lower: 'trapezius',
  erector_spinae: 'lower-back', lower_back: 'lower-back',
  front_delts: 'deltoids', side_delts: 'deltoids', rear_delts: 'deltoids',
  biceps: 'biceps', triceps: 'triceps', forearm: 'forearm',
  abs: 'abs', obliques: 'obliques', serratus: 'obliques',
  quads: 'quadriceps', quads_vastus: 'quadriceps', quads_rectus: 'quadriceps',
  tfl: 'quadriceps',
  hams: 'hamstring', hams_inner: 'hamstring', hams_outer: 'hamstring',
  gluteal: 'gluteal', gluteus_medius: 'gluteal',
  adductors: 'adductors', calves: 'calves', fibularis: 'calves', tibialis: 'tibialis',
};

// Micro-segment ID → Korean label
const MUSCLE_ID_LABEL = {
  chest: '가슴', chest_upper: '상부 가슴', chest_mid: '중부 가슴', chest_lower: '하부 가슴',
  lats: '광배근', rhomboids: '능형근',
  traps_upper: '승모근 상부', traps_mid: '승모근 중부', traps_lower: '승모근 하부',
  erector_spinae: '척추기립근', lower_back: '요방형근',
  front_delts: '전면 삼각근', side_delts: '측면 삼각근', rear_delts: '후면 삼각근',
  biceps: '이두근', triceps: '삼두근', forearm: '전완근',
  abs: '복직근', obliques: '외복사근', serratus: '전거근',
  quads: '대퇴사두', quads_vastus: 'Vastus Lateralis', quads_rectus: '대퇴직근',
  tfl: 'TFL',
  hams: '햄스트링', hams_inner: '햄스트링 내측', hams_outer: '햄스트링 외측',
  gluteal: '둔근', gluteus_medius: '중둔근',
  adductors: '내전근', calves: '종아리', fibularis: '비골근', tibialis: '전경골근',
  // library slugs (legacy)
  'upper-back': '등 상부', 'lower-back': '등 하부', trapezius: '승모근',
  deltoids: '어깨', quadriceps: '대퇴사두', hamstring: '햄스트링',
};

const toLibrarySlug = (id) => MUSCLE_ID_TO_SLUG[id] ?? id;
const toLabel       = (id) => MUSCLE_ID_LABEL[id] ?? id;

// Resolve which muscles an exercise has (handles new array + legacy single)
const resolveMuscles = (post) => {
  if (Array.isArray(post.target_muscles) && post.target_muscles.length > 0)
    return post.target_muscles;
  if (post.target_muscle) return [post.target_muscle];
  return [];
};

// Preferred display side for a muscle list
const preferredSide = (muscles, bodyPart) => {
  const backSlugs = ['upper-back', 'lower-back', 'trapezius', 'gluteal', 'hamstring',
    'triceps', 'lats', 'rhomboids', 'traps_upper', 'traps_mid', 'traps_lower',
    'erector_spinae', 'lower_back', 'rear_delts', 'hams', 'hams_inner', 'hams_outer', 'calves'];
  if (muscles.length > 0 && backSlugs.includes(muscles[0])) return 'back';
  return BODY_PART_META[bodyPart]?.side ?? 'front';
};

// ── Mini muscle map (list card) ───────────────────────────────────────────────

const MiniMuscleMap = ({ muscles, bodyPart, scale = 0.3 }) => {
  const side = preferredSide(muscles, bodyPart);
  const data = useMemo(
    () => muscles.slice(0, 3).map((id, idx) => ({
      slug: toLibrarySlug(id),
      color: idx === 0 ? '#16a34a' : '#86efac',
    })),
    [muscles]
  );

  if (muscles.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Dumbbell size={18} strokeWidth={1} className="text-zinc-300" />
      </div>
    );
  }
  return (
    <div className="w-full h-full flex items-start justify-center overflow-hidden">
      <Body
        data={data}
        side={side}
        gender="male"
        scale={scale}
        border="none"
        defaultFill="#e5e7eb"
        colors={['#16a34a', '#86efac']}
      />
    </div>
  );
};

// ── Full-screen detail view ────────────────────────────────────────────────────

const ExerciseDetail = ({ post, onClose }) => {
  const muscles = resolveMuscles(post);
  const views = Array.isArray(post.active_views) && post.active_views.length > 0
    ? post.active_views
    : [preferredSide(muscles, post.body_part)];

  const [activeView, setActiveView] = useState(views[0]);

  const bodyData = useMemo(
    () => muscles.map((id, idx) => ({
      slug: toLibrarySlug(id),
      color: idx === 0 ? '#16a34a' : '#86efac',
    })),
    [muscles]
  );

  const viewLabel = (v) => v === 'front' ? '전면' : v === 'back' ? '후면' : '측면';

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom duration-200">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-100 flex items-center justify-between px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-100 transition text-zinc-900 text-lg font-bold"
        >
          ✕
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-900">
            {CATEGORY_LABEL[post.category] ?? post.category}
          </span>
          {post.body_part && (
            <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
              {post.body_part}
            </span>
          )}
        </div>
        <div className="w-9" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {post.video_url ? (
          <div className="w-full bg-black mb-8">
            <video src={post.video_url} autoPlay loop muted playsInline className="w-full h-auto object-contain" />
          </div>
        ) : post.image_url ? (
          <div className="w-full bg-zinc-100 mb-8">
            <img src={post.image_url} alt={post.title} className="w-full h-auto object-contain" />
          </div>
        ) : null}

        <div className="px-6 py-8 flex flex-col">
          <h1 className="text-3xl font-black text-zinc-900 mb-3 leading-tight">{post.title}</h1>
          <p className="text-sm text-zinc-600 leading-relaxed mb-10 whitespace-pre-wrap">{post.content}</p>

          {/* ── Anatomy display ── */}
          {muscles.length > 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-zinc-100 shadow-sm overflow-hidden bg-white">
              {/* Panel header — clinical chart style */}
              <div className="w-full flex items-center justify-between px-5 py-3 border-b border-zinc-100 bg-[#F8F9FA]">
                <div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.22em]">Anatomy · Target Muscle</p>
                  <p className="text-xs font-semibold text-zinc-700 mt-0.5">근육 분석 차트</p>
                </div>
                {/* View switcher pills */}
                {views.length > 1 && (
                  <div className="flex gap-1">
                    {views.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setActiveView(v)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                          activeView === v
                            ? 'bg-[#064e3b] text-white shadow-sm'
                            : 'bg-white border border-zinc-200 text-zinc-500'
                        }`}
                      >
                        {viewLabel(v)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Body visualization — centered, generous padding */}
              <div className="w-full flex justify-center items-start py-6 bg-[#F8F9FA]">
                {activeView !== 'side' ? (
                  <div className="flex items-start justify-center overflow-hidden">
                    <Body
                      data={bodyData}
                      side={activeView}
                      gender="male"
                      scale={0.95}
                      border="none"
                      defaultFill="#e5e7eb"
                      defaultStroke="#d1d5db"
                      defaultStrokeWidth={0.5}
                      colors={['#16a34a', '#86efac']}
                    />
                  </div>
                ) : (
                  <SideBodyView
                    activeMuscleIds={muscles}
                    scale={0.95}
                  />
                )}
              </div>

              {/* Muscle legend — clinical tag style */}
              <div className="w-full px-5 py-4 border-t border-zinc-100 bg-white">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-2.5">근육 분류</p>
                <div className="flex flex-wrap gap-2">
                  {muscles.map((id, idx) => (
                    <span
                      key={id}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide ${
                        idx === 0
                          ? 'bg-[#064e3b] text-white shadow-sm'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                      }`}
                    >
                      <span className={`text-[8px] font-black uppercase tracking-wider opacity-70 ${idx === 0 ? 'text-emerald-300' : 'text-emerald-500'}`}>
                        {idx === 0 ? '주동' : '보조'}
                      </span>
                      {toLabel(id)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-zinc-50 rounded-2xl border border-zinc-100">
              <Dumbbell size={32} strokeWidth={1} className="text-zinc-300 mb-3" />
              <p className="text-xs text-zinc-400 uppercase tracking-widest">타겟 근육 정보 없음</p>
            </div>
          )}

          <div className="h-12" />
        </div>
      </div>
    </div>
  );
};

// ── Main list component ────────────────────────────────────────────────────────

const MemberExerciseLibrary = ({ goBack }) => {
  const [posts, setPosts] = useState([]);
  const [bodyPartOptions, setBodyPartOptions] = useState(DEFAULT_BODY_PARTS);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [selectedPost, setSelectedPost] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, catsRes] = await Promise.all([
        supabase.from('posts').select('*').in('category', EXERCISE_CATEGORIES).order('created_at', { ascending: false }),
        supabase.from('exercise_categories').select('label').order('created_at', { ascending: true }),
      ]);
      if (!postsRes.error) setPosts(postsRes.data || []);
      if (!catsRes.error && catsRes.data?.length > 0) {
        setBodyPartOptions(catsRes.data.map((c) => c.label));
      }
    } catch (e) {
      console.error('[MemberExerciseLibrary] fetch:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredExercises = useMemo(
    () =>
      activeCategory === '전체'
        ? posts
        : posts.filter((p) => p.body_part === activeCategory),
    [posts, activeCategory]
  );

  return (
    <>
      <div className="min-h-[100dvh] bg-[#F8F9FA] text-slate-900 flex flex-col font-sans">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button type="button" onClick={goBack} className="rounded-lg p-1.5 hover:bg-zinc-100 transition-colors" aria-label="뒤로">
            <ArrowLeft size={20} strokeWidth={1.5} className="text-zinc-500" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold tracking-tight text-slate-900">운동 라이브러리</h1>
            <p className="text-[10px] text-zinc-400 uppercase tracking-[0.15em]">Exercise Library</p>
          </div>
        </header>

        {/* Horizontal pill filter */}
        <div className="w-full overflow-x-auto no-scrollbar py-3 px-4 bg-white border-b border-zinc-100">
          <div className="flex gap-2 w-max">
            {['전체', ...bodyPartOptions].map((part) => (
              <button
                key={part}
                type="button"
                onClick={() => setActiveCategory(part)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  activeCategory === part
                    ? 'bg-[#1a1a1a] text-white border-transparent shadow-md'
                    : 'bg-white border border-zinc-200 text-zinc-500 shadow-sm hover:border-zinc-400 hover:text-zinc-700'
                }`}
              >
                {part}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <main className="flex-1 px-4 pt-4 pb-24">
          {loading ? (
            <div className="flex justify-center pt-16">
              <p className="text-sm text-zinc-400 tracking-wide">Loading…</p>
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 gap-3 text-zinc-400">
              <Dumbbell size={36} strokeWidth={1} />
              <p className="text-sm">
                {activeCategory === '전체' ? '등록된 운동이 없습니다.' : `${activeCategory} 부위의 운동이 아직 없습니다.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredExercises.map((post) => {
                const muscles = resolveMuscles(post);

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedPost(post)}
                    className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm text-left w-full transition-all hover:border-zinc-300 hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-4 w-full">
                      {/* Thumbnail */}
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0 relative">
                        {post.video_url ? (
                          <>
                            <video src={`${post.video_url}#t=0.001`} preload="metadata" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-black/50 border border-white/30 flex items-center justify-center backdrop-blur-sm">
                                <span className="text-xs ml-0.5 text-white">▶</span>
                              </div>
                            </div>
                          </>
                        ) : post.image_url ? (
                          <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Dumbbell size={24} strokeWidth={1} className="text-zinc-300" />
                          </div>
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                            {CATEGORY_LABEL[post.category] ?? post.category}
                          </span>
                          {post.body_part && (
                            <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                              {post.body_part}
                            </span>
                          )}
                        </div>
                        <span className="text-base font-bold text-zinc-900 truncate">{post.title}</span>
                        {muscles.length > 0 && (
                          <div className="mt-1 flex gap-1 flex-wrap">
                            {muscles.slice(0, 2).map((id, idx) => (
                              <span
                                key={id}
                                className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                                  idx === 0
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-zinc-50 text-zinc-500 border border-zinc-100'
                                }`}
                              >
                                {toLabel(id)}
                              </span>
                            ))}
                            {muscles.length > 2 && (
                              <span className="text-[10px] text-zinc-400">+{muscles.length - 2}</span>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-zinc-500 truncate mt-1">{post.content}</span>
                      </div>

                      {/* Mini muscle map */}
                      <div className="w-[76px] h-[120px] rounded-md bg-[#F8F9FA] border border-zinc-100 flex-shrink-0 overflow-hidden">
                        <MiniMuscleMap muscles={muscles} bodyPart={post.body_part} scale={0.3} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {selectedPost && (
        <ExerciseDetail post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </>
  );
};

export default MemberExerciseLibrary;
