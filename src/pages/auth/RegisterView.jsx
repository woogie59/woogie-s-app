import React, { useState } from 'react';
import { ArrowLeft, User, Calendar, Mail, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import ButtonPrimary from '../../components/ui/ButtonPrimary';
import { LabDotBrand } from '../../components/ui/LabDotBrand';

const RegisterView = ({ setView, goBack, onSignupSuccess }) => {
  const { showAlert } = useGlobalModal();
  const [formData, setFormData] = useState({ email: '', password: '', name: '', dob: '', gender: 'M' });
  const [loading, setLoading] = useState(false);

  const handleRegisterSubmit = async () => {
    if (!formData.email || !formData.password || !formData.name) {
      showAlert({ message: '필수 정보(이메일, 비밀번호, 이름)를 모두 입력해주세요.' });
      return;
    }
    if (formData.password.length < 6) {
      showAlert({ message: '비밀번호는 최소 6자리 이상이어야 합니다.' });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            dob: formData.dob,
            gender: formData.gender,
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

        let profileReadyForNotify = false;

        if (!existingProfile) {
          const { data: createdProfile, error: insErr } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              name: formData.name,
              role: 'user',
            })
            .select('id')
            .single();

          if (insErr) {
            console.error('❌ profiles insert 실패 (관리자 알림 전송 안 함):', insErr.message, insErr);
          } else if (createdProfile?.id) {
            profileReadyForNotify = true;
          } else {
            console.warn('⚠️ profiles insert 오류 없으나 select id 없음 — 알림 생략', { createdProfile });
          }
        } else {
          console.log(
            'ℹ️ profiles 행이 이미 존재 (트리거 등). insert 생략 — 동일 가입 플로우에서 관리자 알림은 아래에서 시도합니다.',
            { userId: user.id }
          );
          profileReadyForNotify = true;
        }

        if (profileReadyForNotify) {
          console.log('✅ 회원가입 DB 저장 완료. 관리자 알림 발송 시도...');

          try {
            const { data: notifyData, error: notifyError } = await supabase.functions.invoke('notify-admin-events', {
              body: {
                title: '신규 회원 가입',
                message: `${formData.name || '신규'} 회원님이 가입하셨습니다. 승인해주세요.`,
              },
            });

            if (notifyError) throw notifyError;
            console.log('🎯 관리자 알림 스위치 격발 성공:', notifyData);
          } catch (err) {
            console.error('❌ 관리자 알림 스위치 격발 실패 (프론트엔드 에러):', err);
          }
        }
      } else {
        console.warn('⚠️ signUp 응답에 user 없음 — profiles/알림 생략');
      }

      if (onSignupSuccess) onSignupSuccess(formData.name);
    } catch (err) {
      console.error(err);
      showAlert({ message: `🚨 가입 실패: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 p-6 flex flex-col">
      <header className="mb-8">
        <button type="button" onClick={() => (goBack ? goBack() : setView('login'))}>
          <ArrowLeft className="text-gray-500 hover:text-slate-900 transition-colors" />
        </button>
        <div className="mt-6">
          <LabDotBrand variant="header" />
        </div>
        <p className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mt-3">Join · Silent Luxury Lab</p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto pb-10">
        <div className="space-y-2">
          <label className="text-xs text-gray-500 ml-1">Account Info</label>
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="email" placeholder="이메일 (ID)" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-slate-900 focus:border-emerald-600 outline-none transition-colors" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="password" placeholder="비밀번호 (6자리 이상)" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-slate-900 focus:border-emerald-600 outline-none transition-colors" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500 ml-1">Personal Info</label>
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" placeholder="이름" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-slate-900 focus:border-emerald-600 outline-none transition-colors" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="생년월일 (예: 900101)" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-slate-900 focus:border-emerald-600 outline-none transition-colors" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
            </div>
            <div className="relative w-1/3">
              <select className="w-full h-full bg-gray-50 border border-gray-200 rounded-xl px-4 text-slate-900 focus:border-emerald-600 outline-none appearance-none" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                <option value="M">남성</option>
                <option value="F">여성</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
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
