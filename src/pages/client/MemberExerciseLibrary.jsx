import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, X, Dumbbell, RotateCcw } from 'lucide-react';
import Body from 'react-muscle-highlighter';
import { supabase } from '../../lib/supabaseClient';

// ── Muscle mapping ─────────────────────────────────────────────────────────────

/** All slugs the library supports, grouped by view side */
const FRONT_SLUGS = ['chest', 'abs', 'obliques', 'biceps', 'forearm', 'deltoids', 'quadriceps', 'adductors', 'tibialis', 'knees', 'ankles'];
const BACK_SLUGS  = ['upper-back', 'lower-back', 'trapezius', 'triceps', 'gluteal', 'hamstring', 'calves'];

/** body_part (Korean) → primary display slug + preferred side */
const BODY_PART_META = {
  '가슴': { slug: 'chest',      side: 'front' },
  '등':   { slug: 'upper-back', side: 'back'  },
  '하체': { slug: 'quadriceps', side: 'front' },
  '어깨': { slug: 'deltoids',   side: 'front' },
  '팔':   { slug: 'biceps',     side: 'front' },
  '코어': { slug: 'abs',        side: 'front' },
  '전신': { slug: null,         side: 'front' },
};

/** target_muscle (slug) → which body_part group it belongs to */
const SLUG_TO_BODY_PART = {
  chest: '가슴',
  abs: '코어', obliques: '코어',
  biceps: '팔', triceps: '팔', forearm: '팔',
  deltoids: '어깨',
  quadriceps: '하체', hamstring: '하체', gluteal: '하체', calves: '하체', adductors: '하체',
  'upper-back': '등', 'lower-back': '등', trapezius: '등',
};

/** Human-readable Korean labels for slugs (shown in chip below model) */
const SLUG_KO = {
  chest: '가슴', abs: '복근', obliques: '옆구리',
  biceps: '이두', triceps: '삼두', forearm: '전완',
  deltoids: '어깨', 'upper-back': '등 상부', 'lower-back': '등 하부',
  trapezius: '승모근', quadriceps: '대퇴사두', hamstring: '햄스트링',
  gluteal: '둔근', calves: '종아리', adductors: '내전근',
  tibialis: '전경골', knees: '무릎', ankles: '발목',
};

// ── Mini muscle map (non-interactive, tiny) ────────────────────────────────────

const MiniMuscleMap = ({ slug, side }) => {
  const data = useMemo(
    () => (slug ? [{ slug, color: '#16a34a' }] : []),
    [slug]
  );
  if (!slug) return (
    <div className="w-full h-full flex items-center justify-center">
      <Dumbbell size={18} strokeWidth={1} className="text-zinc-300" />
    </div>
  );
  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <div style={{ transform: 'scale(0.18)', transformOrigin: 'top center', height: 0, marginTop: -4 }}>
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

const EXERCISE_CATEGORIES = ['Exercise', 'Routine'];
const CATEGORY_LABEL = { Exercise: '운동', Routine: '루틴' };

const MemberExerciseLibrary = ({ goBack }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bodyView, setBodyView] = useState('front');       // 'front' | 'back'
  const [selectedSlug, setSelectedSlug] = useState(null);  // clicked muscle slug
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

  // Build highlight data for the anatomy model
  const anatomyData = useMemo(() => {
    if (selectedSlug) {
      return [{ slug: selectedSlug, color: '#16a34a' }];
    }
    // Show all muscle groups that have at least one exercise
    const slugsWithExercises = new Set(
      posts.map((p) => {
        const meta = BODY_PART_META[p.body_part];
        return meta?.slug;
      }).filter(Boolean)
    );
    return [...slugsWithExercises].map((slug) => ({ slug, color: '#bbf7d0', intensity: 1 }));
  }, [selectedSlug, posts]);

  const handleBodyPartPress = (part) => {
    const slug = part?.slug;
    if (!slug) return;
    // Toggle: clicking same slug deselects
    setSelectedSlug((prev) => (prev === slug ? null : slug));
    // Auto-switch view side to show the clicked muscle
    if (FRONT_SLUGS.includes(slug)) setBodyView('front');
    else if (BACK_SLUGS.includes(slug)) setBodyView('back');
  };

  // Filter exercises based on selected slug or body_part match
  const filteredExercises = useMemo(() => {
    if (!selectedSlug) return posts;
    const targetBodyPart = SLUG_TO_BODY_PART[selectedSlug];
    return posts.filter((p) => {
      // Match by target_muscle slug (fine-grained) OR by broad body_part category
      if (p.target_muscle === selectedSlug) return true;
      if (targetBodyPart && p.body_part === targetBodyPart) return true;
      return false;
    });
  }, [posts, selectedSlug]);

  const selectedLabel = selectedSlug ? (SLUG_KO[selectedSlug] || selectedSlug) : null;

  return (
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

      {/* Anatomy section */}
      <div className="bg-white border-b border-zinc-100 px-4 pt-5 pb-4">
        {/* 앞 / 뒤 switcher */}
        <div className="flex justify-center gap-2 mb-4">
          {[
            { key: 'front', label: '앞면' },
            { key: 'back',  label: '뒷면' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setBodyView(key)}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                bodyView === key
                  ? 'bg-[#1a1a1a] text-white shadow-md'
                  : 'bg-white border border-zinc-200 text-zinc-500 shadow-sm hover:border-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Interactive anatomy model */}
        <div className="flex justify-center" style={{ minHeight: 220 }}>
          <Body
            data={anatomyData}
            side={bodyView}
            gender="male"
            scale={0.75}
            border="#e4e4e7"
            defaultFill="#f1f5f9"
            colors={['#bbf7d0', '#16a34a']}
            onBodyPartPress={handleBodyPartPress}
          />
        </div>

        {/* Selected muscle chip / hint */}
        <div className="mt-3 flex justify-center min-h-[28px]">
          {selectedSlug ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1 text-sm font-semibold text-emerald-700">
              <span>{selectedLabel}</span>
              <button
                type="button"
                onClick={() => setSelectedSlug(null)}
                className="text-emerald-500 hover:text-emerald-700 transition"
                aria-label="필터 초기화"
              >
                <RotateCcw size={12} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 tracking-wide">근육 부위를 탭하면 해당 운동만 표시됩니다</p>
          )}
        </div>
      </div>

      {/* Exercise list */}
      <main className="flex-1 px-4 pt-4 pb-24">
        {loading ? (
          <div className="flex justify-center pt-16">
            <p className="text-sm text-zinc-400 tracking-wide">Loading…</p>
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 gap-3 text-zinc-400">
            <Dumbbell size={36} strokeWidth={1} />
            <p className="text-sm text-center">
              {selectedSlug
                ? `${selectedLabel} 운동이 아직 없습니다.`
                : '등록된 운동이 없습니다.'}
            </p>
            {selectedSlug && (
              <button
                type="button"
                onClick={() => setSelectedSlug(null)}
                className="mt-1 text-xs text-emerald-600 underline underline-offset-2"
              >
                전체 보기
              </button>
            )}
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
                  className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 text-left w-full transition-all hover:border-zinc-300 hover:shadow-md active:scale-[0.99]"
                >
                  {/* Left: video/image thumbnail */}
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

                  {/* Center: text */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
                        {CATEGORY_LABEL[post.category] ?? post.category}
                      </span>
                      {post.body_part && (
                        <span className="text-[10px] text-zinc-400 border border-zinc-200 rounded-full px-1.5 py-0.5 bg-zinc-50">
                          {post.body_part}
                        </span>
                      )}
                    </div>
                    <span className="text-base font-bold text-zinc-900 line-clamp-1">{post.title}</span>
                    <span className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{post.content}</span>
                  </div>

                  {/* Right: mini muscle map */}
                  <div className="w-16 h-20 rounded-lg bg-zinc-50 border border-zinc-100 flex-shrink-0 overflow-hidden flex items-start justify-center pt-1">
                    <MiniMuscleMap slug={primarySlug} side={mapSide} />
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
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-100 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
                    {CATEGORY_LABEL[selectedPost.category] ?? selectedPost.category}
                  </span>
                  {selectedPost.body_part && (
                    <span className="text-[10px] text-zinc-400 border border-zinc-200 rounded-full px-2 py-0.5 bg-zinc-50">
                      {selectedPost.body_part}
                    </span>
                  )}
                  {primarySlug && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                      {SLUG_KO[primarySlug] || primarySlug}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedPost(null)} className="rounded-lg p-1 hover:bg-zinc-100 transition">
                  <X size={18} className="text-zinc-400" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                {selectedPost.video_url && (
                  <div className="w-full bg-black border-b border-zinc-100">
                    <video src={selectedPost.video_url} autoPlay loop muted playsInline className="w-full h-auto max-h-64 object-cover" />
                  </div>
                )}
                {!selectedPost.video_url && selectedPost.image_url && (
                  <img src={selectedPost.image_url} alt={selectedPost.title} className="w-full h-52 object-cover border-b border-zinc-100" />
                )}

                {/* Muscle highlight inside detail */}
                {primarySlug && (
                  <div className="px-5 pt-4 pb-0 flex justify-center">
                    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-3 flex items-center gap-4">
                      <div style={{ transform: 'scale(0.28)', transformOrigin: 'top center', height: 0, marginTop: -4 }}>
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
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-widest">주 운동 근육</p>
                        <p className="text-sm font-bold text-zinc-800 mt-0.5">{SLUG_KO[primarySlug] || primarySlug}</p>
                      </div>
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
