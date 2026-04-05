import React, { useState, useRef, useEffect } from 'react';
import { supabase, REMEMBER_ME_KEY } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import ButtonPrimary from '../../components/ui/ButtonPrimary';
import { LabDotBrand } from '../../components/ui/LabDotBrand';

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
  const emailInputRef = useRef(null);

  useEffect(() => {
    if (!showForgotPassword) {
      const t = requestAnimationFrame(() => {
        emailInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(t);
    }
  }, [showForgotPassword]);

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
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 bg-white text-slate-900">
      <div className="mb-12 flex w-full justify-center">
        <LabDotBrand variant="hero" />
      </div>

      {!showForgotPassword ? (
        <>
          <div className="w-full max-w-sm space-y-5">
            <input
              ref={emailInputRef}
              type="text"
              autoComplete="username"
              placeholder="EMAIL / ID"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-gray-400 focus:border-[#064e3b]/40 focus:ring-1 focus:ring-[#064e3b]/20 outline-none transition-colors"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="PASSWORD"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-gray-400 focus:border-[#064e3b]/40 focus:ring-1 focus:ring-[#064e3b]/20 outline-none transition-colors"
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
                className="w-5 h-5 rounded border-2 border-gray-300 bg-gray-50 text-emerald-600 focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-0 focus:ring-offset-white cursor-pointer accent-emerald-500 checked:border-emerald-500"
              />
              <span className="text-gray-500 group-hover:text-gray-600 text-sm font-medium">자동 로그인 유지</span>
            </label>

            <ButtonPrimary onClick={handleLogin}>
              {loading ? 'CHECKING...' : 'ENTER'}
            </ButtonPrimary>
          </div>

          <button
            onClick={() => setShowForgotPassword(true)}
            className="mt-4 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
          >
            Forgot Password?
          </button>

          <div className="flex gap-4 mt-6 text-xs text-gray-500">
            <button onClick={() => setView('register')} className="hover:text-emerald-600">회원가입</button>
          </div>
        </>
      ) : (
        <div className="w-full max-w-sm bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-xl font-bold text-emerald-600 mb-4">Reset Password</h3>
          <p className="text-sm text-gray-500 mb-4">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <input
            type="email"
            placeholder="Enter your email"
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 placeholder-gray-400 focus:border-emerald-600 outline-none transition-colors mb-4"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setShowForgotPassword(false)}
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 hover:text-slate-900 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleForgotPassword}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition-all"
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
