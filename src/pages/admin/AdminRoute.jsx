import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const AdminRoute = ({ children, session, setView }) => {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!session?.user?.id) {
        setView?.('login');
        setChecking(false);
        return;
      }
      const { data, error } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      setChecking(false);
      if (error || data?.role !== 'admin') {
        setIsAdmin(false);
        setView?.('client_home');
      } else {
        setIsAdmin(true);
      }
    };
    check();
  }, [session?.user?.id, setView]);

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
          onClick={() => setView?.('client_home')}
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
