import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, X, Dumbbell } from 'lucide-react';
import Body from 'react-muscle-highlighter';
import { supabase } from '../../lib/supabaseClient';

// ── Constants ──────────────────────────────────────────────────────────────────

const EXERCISE_CATEGORIES = ['Exercise', 'Routine'];
const CATEGORY_LABEL = { Exercise: '운동', Routine: '루틴' };
const DEFAULT_BODY_PARTS = ['가슴', '등', '하체', '어깨', '팔', '코어', '전신']; // fallback

const BODY_PART_META = {
  '가슴': { slug: 'chest',      side: 'front' },
  '등':   { slug: 'upper-back', side: 'back'  },
  '하체': { slug: 'quadriceps', side: 'front' },
  '어깨': { slug: 'deltoids',   side: 'front' },
  '팔':   { slug: 'biceps',     side: 'front' },
  '코어': { slug: 'abs',        side: 'front' },
  '전신': { slug: null,         side: 'front' },
};

const SLUG_KO = {
  chest: '가슴', abs: '복근', obliques: '옆구리',
  biceps: '이두', triceps: '삼두', forearm: '전완',
  deltoids: '어깨', 'upper-back': '등 상부', 'lower-back': '등 하부',
  trapezius: '승모근', quadriceps: '대퇴사두', hamstring: '햄스트링',
  gluteal: '둔근', calves: '종아리', adductors: '내전근',
};

// ── Mini muscle map ────────────────────────────────────────────────────────────
// Uses scale prop directly (no CSS transform) — prevents head cropping.
// scale=0.3 renders the body at ~60×120px which fits the 76×120 container.

const MiniMuscleMap = ({ slug, side, scale = 0.3 }) => {
  const data = useMemo(
    () => (slug ? [{ slug, color: '#16a34a' }] : []),
    [slug]
  );
  if (!slug) {
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
        side={side || 'front'}
        gender="male"
        scale={scale}
        border="none"
        defaultFill="#e5e7eb"
        colors={['#16a34a']}
      />
    </div>
  );
};

// ── Full-screen detail view ────────────────────────────────────────────────────

const ExerciseDetail = ({ post, onClose }) => {
  const meta = BODY_PART_META[post.body_part];
  const primarySlug = post.target_muscle || meta?.slug || null;
  const mapSide = meta?.side || 'front';

  const muscleData = useMemo(
    () => (primarySlug ? [{ slug: primarySlug, color: '#16a34a' }] : []),
    [primarySlug]
  );

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
        {/* Full-width video — preserves intrinsic ratio, no cropping */}
        {post.video_url ? (
          <div className="w-full bg-black mb-8">
            <video
              src={post.video_url}
              autoPlay loop muted playsInline
              className="w-full h-auto object-contain"
            />
          </div>
        ) : post.image_url ? (
          <div className="w-full bg-zinc-100 mb-8">
            <img src={post.image_url} alt={post.title} className="w-full h-auto object-contain" />
          </div>
        ) : null}

        {/* Content */}
        <div className="px-6 py-8 flex flex-col">
          <h1 className="text-3xl font-black text-zinc-900 mb-3 leading-tight">{post.title}</h1>
          <p className="text-sm text-zinc-600 leading-relaxed mb-10 whitespace-pre-wrap">{post.content}</p>

          {/* Enlarged anatomy display — multi-view */}
          {primarySlug ? (
            <div className="flex flex-col items-center p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="text-[10px] font-bold text-emerald-600 tracking-[0.2em] mb-4 uppercase">Target Muscle</p>
              {/* Render each active_view side */}
              <div className="flex gap-6 justify-center flex-wrap">
                {(Array.isArray(post.active_views) && post.active_views.length > 0
                  ? post.active_views
                  : [mapSide]
                ).map((viewSide) => (
                  <div key={viewSide} className="flex flex-col items-center gap-2">
                    <div className="w-48 h-[300px] flex items-start justify-center overflow-hidden">
                      <Body
                        data={[{ slug: primarySlug, color: '#16a34a' }]}
                        side={viewSide}
                        gender="male"
                        scale={0.9}
                        border="none"
                        defaultFill="#e5e7eb"
                        colors={['#16a34a']}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                      {viewSide === 'front' ? '전면' : '후면'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-lg font-bold text-zinc-800">
                {SLUG_KO[primarySlug] || primarySlug}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
              <Dumbbell size={36} strokeWidth={1} className="text-zinc-300 mb-3" />
              <p className="text-sm text-zinc-400">타겟 근육 정보 없음</p>
            </div>
          )}

          {/* Bottom safe area */}
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
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg p-1.5 hover:bg-zinc-100 transition-colors"
            aria-label="뒤로"
          >
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
                const meta = BODY_PART_META[post.body_part];
                const primarySlug = post.target_muscle || meta?.slug || null;
                const mapSide = meta?.side || 'front';

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedPost(post)}
                    className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm text-left w-full transition-all hover:border-zinc-300 hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-4 w-full">
                      {/* 1. Left — video/image thumbnail */}
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0 relative">
                        {post.video_url ? (
                          <>
                            <video
                              src={`${post.video_url}#t=0.001`}
                              preload="metadata"
                              className="w-full h-full object-cover"
                            />
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

                      {/* 2. Middle text — flex-1 min-w-0 prevents overflow */}
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
                        <span className="text-xs text-zinc-500 truncate mt-1">{post.content}</span>
                      </div>

                      {/* 3. Right — mini muscle map (tall rect, no CSS transform) */}
                      <div className="w-[76px] h-[120px] rounded-md bg-zinc-50 border border-zinc-100 flex-shrink-0 overflow-hidden">
                        <MiniMuscleMap slug={primarySlug} side={mapSide} scale={0.3} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Full-screen detail view — rendered outside main flow */}
      {selectedPost && (
        <ExerciseDetail post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </>
  );
};

export default MemberExerciseLibrary;
