import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Ultra-minimal post-auth welcome — name from `profiles` (fallback: metadata / email).
 */
export default function WelcomeScreen({ userId, onStart, initialName = '' }) {
  const [displayName, setDisplayName] = useState(() => (initialName && String(initialName).trim()) || '');

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
      if (cancelled) return;
      const n = data?.name?.trim();
      if (n) {
        setDisplayName(n);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user;
      const fallback =
        u?.user_metadata?.full_name?.trim() || u?.email?.split('@')[0] || '회원';
      setDisplayName(fallback);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const line = `${displayName || '회원'}님, 환영합니다.`;

  return (
    <div className="fixed inset-0 z-[70] min-h-[100dvh] bg-white flex flex-col items-center justify-center px-8 font-sans antialiased">
      <p className="text-2xl sm:text-3xl font-light text-gray-900 tracking-tight text-center max-w-md leading-snug">
        {line}
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-8 bg-[#064e3b] text-white rounded-xl px-10 py-4 font-medium tracking-wider active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#064e3b]/40 focus-visible:ring-offset-2"
      >
        시작하기
      </button>
    </div>
  );
}
