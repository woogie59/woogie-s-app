import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const AdminRoute = ({ children, session, replaceView, knownRole = null }) => {
  const [checking, setChecking] = useState(knownRole !== 'admin');
  const [isAdmin, setIsAdmin] = useState(knownRole === 'admin');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!session?.user?.id) {
        if (!cancelled) {
          setIsAdmin(false);
          setChecking(false);
          replaceView?.('login');
        }
        return;
      }

      if (knownRole === 'admin') {
        if (!cancelled) {
          setIsAdmin(true);
          setChecking(false);
        }
      }

      let role = null;
      for (let i = 0; i < 4; i += 1) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!error && data?.role) {
          role = data.role;
          break;
        }
        await new Promise((r) => setTimeout(r, 250 * (i + 1)));
      }

      if (cancelled) return;

      const allowed = role === 'admin' || knownRole === 'admin';
      setIsAdmin(allowed);
      setChecking(false);
      if (!allowed) {
        replaceView?.(knownRole === 'admin' ? 'admin_home' : 'client_home');
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, replaceView, knownRole]);

  if (checking) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center text-gray-500">권한 확인 중...</div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center p-6 text-slate-900">
        <p className="text-xl font-bold text-red-500 mb-2">Access Denied</p>
        <p className="text-gray-600 text-sm mb-4">관리자 권한이 필요합니다.</p>
        <button
          type="button"
          onClick={() => replaceView?.(knownRole === 'admin' ? 'admin_home' : 'client_home')}
          className="px-6 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
        >
          홈으로
        </button>
      </div>
    );
  }
  return children;
};

export default AdminRoute;
