import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, X, Dumbbell } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const EXERCISE_CATEGORIES = ['Exercise', 'Routine'];
const CATEGORY_LABEL = { Exercise: '운동', Routine: '루틴' };

const BODY_PARTS = ['전체', '가슴', '등', '하체', '어깨', '팔', '코어', '전신'];

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

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const filteredExercises = posts.filter((ex) =>
    activeCategory === '전체' ? true : ex.body_part === activeCategory
  );

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

      {/* Horizontal filter tabs — scrollable, no scrollbar */}
      <div className="w-full overflow-x-auto no-scrollbar py-4 px-4 border-b border-zinc-800/50">
        <div className="flex gap-2 w-max">
          {BODY_PARTS.map((part) => (
            <button
              key={part}
              type="button"
              onClick={() => setActiveCategory(part)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeCategory === part
                  ? 'bg-zinc-200 text-black'
                  : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {part}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <main className="flex-1 pb-24">
        {loading ? (
          <div className="flex justify-center pt-16">
            <p className="text-sm text-zinc-600 tracking-wide">Loading…</p>
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-3 text-zinc-600">
            <Dumbbell size={36} strokeWidth={1} />
            <p className="text-sm">
              {activeCategory === '전체'
                ? '등록된 운동이 없습니다.'
                : `${activeCategory} 부위의 운동이 아직 없습니다.`}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {filteredExercises.map((post) => (
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
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                        {CATEGORY_LABEL[post.category] ?? post.category}
                      </span>
                      {post.body_part && (
                        <span className="text-[10px] text-zinc-600 border border-zinc-800 rounded-full px-1.5 py-0.5">
                          {post.body_part}
                        </span>
                      )}
                    </div>
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
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  {CATEGORY_LABEL[selectedPost.category] ?? selectedPost.category}
                </span>
                {selectedPost.body_part && (
                  <span className="text-[10px] text-zinc-500 border border-zinc-800 rounded-full px-2 py-0.5">
                    {selectedPost.body_part}
                  </span>
                )}
              </div>
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
