import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import ButtonPrimary from '../../components/ui/ButtonPrimary';

const ResetPasswordView = ({ onClose }) => {
  const { showAlert } = useGlobalModal();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('✅ ResetPasswordView mounted - User can now reset password');
  }, []);

  const handleResetPassword = async () => {
    console.log('🔄 Starting password reset...');

    if (!newPassword) {
      showAlert({ message: '새 비밀번호를 입력해주세요.' });
      return;
    }

    if (newPassword.length < 6) {
      showAlert({ message: '비밀번호는 최소 6자리 이상이어야 합니다.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({ message: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    setLoading(true);

    try {
      console.log('📝 Calling supabase.auth.updateUser...');
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      console.log('✅ Password updated successfully:', data);
      showAlert({ message: '✅ 비밀번호가 변경되었습니다' });

      await supabase.auth.signOut();
      onClose();
    } catch (error) {
      console.error('❌ Password update error:', error);
      showAlert({ message: '오류: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 bg-zinc-950 text-white">
      <div className="mb-8 text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/10 border-2 border-yellow-500 mb-4">
            <span className="text-3xl">🔐</span>
          </div>
        </div>
        <h2 className="text-3xl font-serif text-yellow-500 mb-2">Reset Password</h2>
        <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase">Enter Your New Password</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div>
          <label className="text-xs text-zinc-500 ml-1 mb-1 block">New Password</label>
          <input
            type="password"
            placeholder="새 비밀번호 (6자리 이상)"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none transition-colors"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-zinc-500 ml-1 mb-1 block">Confirm Password</label>
          <input
            type="password"
            placeholder="비밀번호 확인"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none transition-colors"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </div>

        <ButtonPrimary onClick={handleResetPassword} disabled={loading}>
          {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
        </ButtonPrimary>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            onClose();
          }}
          className="w-full text-sm text-zinc-500 hover:text-yellow-500 transition-colors mt-4"
        >
          ← Cancel
        </button>
      </div>

      <div className="mt-8 text-xs text-zinc-700 text-center">
        <p>🔐 Recovery session active</p>
      </div>
    </div>
  );
};

export default ResetPasswordView;
