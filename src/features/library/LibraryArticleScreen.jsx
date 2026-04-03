import React from 'react';
import { ArrowLeft } from 'lucide-react';

const ICON_STROKE = 1.5;

function isLikelyHtml(s) {
  if (!s || typeof s !== 'string') return false;
  return /<[a-z][\s\S]*>/i.test(s.trim());
}

/**
 * Full-screen editorial reader — no modal chrome.
 */
export default function LibraryArticleScreen({ post, onBack }) {
  if (!post) return null;

  const html = isLikelyHtml(post.content);

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col min-h-0 font-sans">
      <header className="shrink-0 px-4 pt-safe pb-3 border-b border-gray-100/90 bg-white/95 backdrop-blur-sm flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="p-2.5 -ml-1 rounded-full text-slate-700 hover:bg-gray-100 active:scale-95 transition-all"
          aria-label="뒤로"
        >
          <ArrowLeft size={22} strokeWidth={ICON_STROKE} />
        </button>
        <span className="text-[10px] tracking-[0.28em] uppercase text-gray-400 font-medium">Knowledge</span>
      </header>

      <article className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-6 py-8 pb-safe max-w-2xl mx-auto w-full">
        {post.image_url && (
          <img
            src={post.image_url}
            alt=""
            className="w-full max-h-[40vh] object-cover rounded-2xl border border-gray-100 shadow-sm mb-10"
          />
        )}
        {post.category && (
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#064e3b]/80 font-medium mb-3">{post.category}</p>
        )}
        <h1 className="text-xl sm:text-3xl font-semibold text-slate-900 tracking-tight leading-tight mb-8">{post.title}</h1>

        {html ? (
          <div
            className="prose prose-slate prose-p:leading-relaxed prose-headings:font-semibold max-w-none text-[15px] sm:text-base text-gray-700 [&_p]:mb-4 [&_p:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <div className="text-[15px] sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">{post.content}</div>
        )}
      </article>
    </div>
  );
}
