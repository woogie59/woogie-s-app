import React, { useState } from 'react';
import { supabase, REMEMBER_ME_KEY } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import ButtonPrimary from '../../components/ui/ButtonPrimary';

const LoginView = ({ setView }) => {
  const { showAlert } = useGlobalModal();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      showAlert({ message: 'Please enter your email address' });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) throw error;

      showAlert({ message: 'Password reset link sent to your email!' });
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error) {
      showAlert({ message: 'Error: ' + error.message });
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: pw,
      });
      if (error) {
        showAlert({ message: '로그인 실패: ' + error.message });
      } else {
        console.log('로그인 성공!', data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 bg-zinc-950 text-white">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-serif text-yellow-500 mb-2">THE COACH</h2>
        <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase">Premium Management System</p>
      </div>

      {!showForgotPassword ? (
        <>
          <div className="w-full max-w-sm space-y-4">
            <input
              type="text"
              placeholder="EMAIL (admin)"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none transition-colors"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="PASSWORD (1234)"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none transition-colors"
              value={pw}
              onChange={e => setPw(e.target.value)}
            />

            <label className="flex items-center gap-3 cursor-pointer select-none group py-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRememberMe(checked);
                  try {
                    localStorage.setItem(REMEMBER_ME_KEY, checked ? 'true' : 'false');
                  } catch {}
                }}
                className="w-5 h-5 rounded border-2 border-zinc-600 bg-zinc-900 text-yellow-500 focus:ring-2 focus:ring-yellow-500/50 focus:ring-offset-0 focus:ring-offset-zinc-950 cursor-pointer accent-yellow-500 checked:border-yellow-500"
              />
              <span className="text-zinc-400 group-hover:text-zinc-300 text-sm font-medium">자동 로그인 유지</span>
            </label>

            <ButtonPrimary onClick={handleLogin}>
              {loading ? 'CHECKING...' : 'ENTER'}
            </ButtonPrimary>
          </div>

          <button
            onClick={() => setShowForgotPassword(true)}
            className="mt-4 text-sm text-zinc-500 hover:text-yellow-500 transition-colors"
          >
            Forgot Password?
          </button>

          <div className="flex gap-4 mt-6 text-xs text-zinc-500">
            <button onClick={() => setView('register')} className="hover:text-yellow-500">회원가입</button>
          </div>
        </>
      ) : (
        <div className="w-full max-w-sm bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <h3 className="text-xl font-bold text-yellow-500 mb-4">Reset Password</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <input
            type="email"
            placeholder="Enter your email"
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:border-yellow-600 outline-none transition-colors mb-4"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setShowForgotPassword(false)}
              className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleForgotPassword}
              className="flex-1 py-3 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-black font-bold transition-all"
            >
              Send Reset Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginView;
