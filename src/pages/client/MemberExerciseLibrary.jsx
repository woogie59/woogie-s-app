import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, X, Dumbbell } from 'lucide-react';
import Body from 'react-muscle-highlighter';
import { supabase } from '../../lib/supabaseClient';

// ── Constants ──────────────────────────────────────────────────────────────────

const EXERCISE_CATEGORIES = ['Exercise', 'Routine'];
const CATEGORY_LABEL = { Exercise: '운동', Routine: '루틴' };
const BODY_PARTS = ['전체', '가슴', '등', '하체', '어깨', '팔', '코어', '전신'];

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

// ── Mini muscle map — non-interactive, scales down to fit container ─────────────

const MiniMuscleMap = ({ slug, side }) => {
  const data = useMemo(
    () => (slug ? [{ slug, color: '#16a34a' }] : []),
    [slug]
  );
  if (!slug) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Dumbbell size={16} strokeWidth={1} className="text-zinc-300" />
      </div>
    );
  }
  return (
    // overflow:hidden clips the SVG; scale shrinks it to fit the 52×84 container
    <div className="w-full h-full overflow-hidden flex items-start justify-center">
      <div style={{ transform: 'scale(0.17)', transformOrigin: 'top center' }}>
        <Body
          data={data}
          side={side || 'front'}
          gender="male"
          scale={1}
          border="none"
          defaultFill="#e5e7eb"
          colors={['#16a34a']}
        />
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const MemberExerciseLibrary = ({ goBack }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('전체');
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
      console.error('[MemberExerciseLibrary] fetch:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const filteredExercises = useMemo(
    () =>
      activeCategory === '전체'
        ? posts
        : posts.filter((p) => p.body_part === activeCategory),
    [posts, activeCategory]
  );

  return (
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

      {/* Horizontal pill filter — scrollable, no scrollbar */}
      <div className="w-full overflow-x-auto no-scrollbar py-3 px-4 bg-white border-b border-zinc-100">
        <div className="flex gap-2 w-max">
          {BODY_PARTS.map((part) => (
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

      {/* Exercise list */}
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
          <div className="flex flex-col gap-3">
            {filteredExercises.map((post) => {
              const meta = BODY_PART_META[post.body_part];
              const primarySlug = post.target_muscle || meta?.slug || null;
              const mapSide = meta?.side || 'front';

              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setSelectedPost(post)}
                  className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm text-left w-full transition-all hover:border-zinc-300 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 w-full">
                    {/* 1. Left — video/image thumbnail */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0 relative">
                      {post.video_url ? (
                        <>
                          <video
                            src={`${post.video_url}#t=0.001`}
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-black/50 border border-white/30 flex items-center justify-center backdrop-blur-sm">
                              <span className="text-[11px] ml-0.5 text-white">▶</span>
                            </div>
                          </div>
                        </>
                      ) : post.image_url ? (
                        <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Dumbbell size={22} strokeWidth={1} className="text-zinc-300" />
                        </div>
                      )}
                    </div>

                    {/* 2. Middle — text (flex-1 + min-w-0 prevents overflow) */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1 flex-wrap">
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
                      <span className="text-xs text-zinc-500 truncate mt-0.5">{post.content}</span>
                    </div>

                    {/* 3. Right — mini muscle map (tall rectangle, not square) */}
                    <div className="w-[52px] h-[84px] rounded-md bg-zinc-50 border border-zinc-100 flex-shrink-0 overflow-hidden">
                      <MiniMuscleMap slug={primarySlug} side={mapSide} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail Modal — video plays ONLY here */}
      {selectedPost && (() => {
        const meta = BODY_PART_META[selectedPost.body_part];
        const primarySlug = selectedPost.target_muscle || meta?.slug || null;
        const mapSide = meta?.side || 'front';
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-100 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    {CATEGORY_LABEL[selectedPost.category] ?? selectedPost.category}
                  </span>
                  {selectedPost.body_part && (
                    <span className="text-[10px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                      {selectedPost.body_part}
                    </span>
                  )}
                  {primarySlug && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                      {SLUG_KO[primarySlug] || primarySlug}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="rounded-lg p-1 hover:bg-zinc-100 transition ml-2"
                >
                  <X size={18} className="text-zinc-400" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                {/* Video */}
                {selectedPost.video_url && (
                  <div className="w-full bg-black border-b border-zinc-100">
                    <video
                      src={selectedPost.video_url}
                      autoPlay loop muted playsInline
                      className="w-full h-auto max-h-64 object-cover"
                    />
                  </div>
                )}
                {!selectedPost.video_url && selectedPost.image_url && (
                  <img
                    src={selectedPost.image_url}
                    alt={selectedPost.title}
                    className="w-full h-52 object-cover border-b border-zinc-100"
                  />
                )}

                {/* Muscle highlight strip */}
                {primarySlug && (
                  <div className="mx-5 mt-4 flex items-center gap-4 bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3">
                    <div className="w-[44px] h-[72px] flex-shrink-0 overflow-hidden">
                      <div style={{ transform: 'scale(0.15)', transformOrigin: 'top center' }}>
                        <Body
                          data={[{ slug: primarySlug, color: '#16a34a' }]}
                          side={mapSide}
                          gender="male"
                          scale={1}
                          border="none"
                          defaultFill="#e5e7eb"
                          colors={['#16a34a']}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest">주 운동 근육</p>
                      <p className="text-sm font-bold text-zinc-800 mt-0.5">{SLUG_KO[primarySlug] || primarySlug}</p>
                    </div>
                  </div>
                )}

                <div className="p-5">
                  <h2 className="text-base font-bold text-slate-900">{selectedPost.title}</h2>
                  <p className="mt-3 text-sm text-zinc-500 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MemberExerciseLibrary;
