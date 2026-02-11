import React, { useState } from 'react';
import { ArrowLeft, User, Calendar, Mail, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import ButtonPrimary from '../../components/ui/ButtonPrimary';

const RegisterView = ({ setView, onSignupSuccess }) => {
  const { showAlert } = useGlobalModal();
  const [form, setForm] = useState({ email: '', password: '', name: '', dob: '', gender: 'M' });
  const [loading, setLoading] = useState(false);

  const handleRegisterSubmit = async () => {
    if (!form.email || !form.password || !form.name) {
      showAlert({ message: '필수 정보(이메일, 비밀번호, 이름)를 모두 입력해주세요.' });
      return;
    }
    if (form.password.length < 6) {
      showAlert({ message: '비밀번호는 최소 6자리 이상이어야 합니다.' });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.name,
            dob: form.dob,
            gender: form.gender,
            role: 'user',
          },
        },
      });

      if (error) throw error;

      const { user } = data;
      if (user) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        if (!existingProfile) {
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            name: form.name,
            role: 'user',
          });
        }
      }

      if (onSignupSuccess) onSignupSuccess(form.name);
    } catch (err) {
      console.error(err);
      showAlert({ message: `🚨 가입 실패: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-6 flex flex-col">
      <header className="mb-6">
        <button onClick={() => setView('login')}><ArrowLeft className="text-zinc-400 hover:text-white transition-colors" /></button>
        <h2 className="text-2xl font-serif text-yellow-500 mt-4">Join The Coach</h2>
        <p className="text-zinc-500 text-xs mt-1">Start your professional journey.</p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto pb-10">
        <div className="space-y-2">
          <label className="text-xs text-zinc-500 ml-1">Account Info</label>
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="email" placeholder="이메일 (ID)" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 pl-12 text-white focus:border-yellow-600 outline-none transition-colors" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="password" placeholder="비밀번호 (6자리 이상)" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 pl-12 text-white focus:border-yellow-600 outline-none transition-colors" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-500 ml-1">Personal Info</label>
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" placeholder="이름" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 pl-12 text-white focus:border-yellow-600 outline-none transition-colors" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" placeholder="생년월일 (예: 900101)" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 pl-12 text-white focus:border-yellow-600 outline-none transition-colors" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
            </div>
            <div className="relative w-1/3">
              <select className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-yellow-600 outline-none appearance-none" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option value="M">남성</option>
                <option value="F">여성</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">▼</div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <ButtonPrimary onClick={handleRegisterSubmit} disabled={loading}>
            {loading ? 'Processing...' : 'Create Account'}
          </ButtonPrimary>
        </div>
      </div>
    </div>
  );
};

export default RegisterView;
