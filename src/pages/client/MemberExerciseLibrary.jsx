import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, X, Dumbbell } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const EXERCISE_CATEGORIES = ['Exercise', 'Routine'];
const ALL_FILTERS = ['전체', '운동', '루틴'];
const FILTER_TO_CATEGORY = { '운동': 'Exercise', '루틴': 'Routine' };
const CATEGORY_LABEL = { Exercise: '운동', Routine: '루틴' };

const MemberExerciseLibrary = ({ goBack }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('전체');
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

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const filtered =
    filter === '전체'
      ? posts
      : posts.filter((p) => p.category === FILTER_TO_CATEGORY[filter]);

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-zinc-200 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#050505]/95 backdrop-blur-sm border-b border-zinc-900 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="rounded-lg p-1.5 hover:bg-zinc-900 transition-colors"
          aria-label="뒤로"
        >
          <ArrowLeft size={20} strokeWidth={1.5} className="text-zinc-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold tracking-tight text-zinc-100">운동 라이브러리</h1>
          <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em]">Exercise Library</p>
        </div>
      </header>

      {/* Filter pills */}
      <div className="px-5 pt-4 pb-2 flex gap-2">
        {ALL_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-zinc-200 text-zinc-900'
                : 'border border-zinc-800 text-zinc-500 hover:border-zinc-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <main className="flex-1 pb-24">
        {loading ? (
          <div className="flex justify-center pt-16">
            <p className="text-sm text-zinc-600 tracking-wide">Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-3 text-zinc-600">
            <Dumbbell size={36} strokeWidth={1} />
            <p className="text-sm">등록된 운동이 없습니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {filtered.map((post) => (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => setSelectedPost(post)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-zinc-900/50 active:bg-zinc-900 transition-colors text-left"
                >
                  {/* Thumbnail — first frame via #t=0.001, zero autoplay cost */}
                  <div className="w-20 h-20 rounded-md overflow-hidden bg-black flex-shrink-0 relative border border-zinc-800">
                    {post.video_url ? (
                      <>
                        <video
                          src={`${post.video_url}#t=0.001`}
                          preload="metadata"
                          className="w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-black/60 border border-zinc-600 flex items-center justify-center backdrop-blur-sm">
                            <span className="text-[10px] ml-0.5 text-zinc-300">▶</span>
                          </div>
                        </div>
                      </>
                    ) : post.image_url ? (
                      <img src={post.image_url} alt={post.title} className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Dumbbell size={20} strokeWidth={1} className="text-zinc-700" />
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
                      {CATEGORY_LABEL[post.category] ?? post.category}
                    </span>
                    <span className="text-sm font-bold text-zinc-200 line-clamp-1">{post.title}</span>
                    <span className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{post.content}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Detail Modal — video plays ONLY here */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#0d0d0d] rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-900 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {CATEGORY_LABEL[selectedPost.category] ?? selectedPost.category}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="rounded-lg p-1 hover:bg-zinc-800 transition"
              >
                <X size={18} className="text-zinc-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {selectedPost.video_url && (
                <div className="w-full bg-black border-b border-zinc-900">
                  <video
                    src={selectedPost.video_url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto max-h-64 object-cover opacity-90"
                  />
                </div>
              )}
              {!selectedPost.video_url && selectedPost.image_url && (
                <img
                  src={selectedPost.image_url}
                  alt={selectedPost.title}
                  className="w-full h-52 object-cover border-b border-zinc-900"
                />
              )}
              <div className="p-5">
                <h2 className="text-base font-bold text-zinc-100">{selectedPost.title}</h2>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberExerciseLibrary;
