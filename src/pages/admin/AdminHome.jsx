import React from 'react';
import { LogOut, Camera } from 'lucide-react';
import OneSignal from 'react-onesignal';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import ButtonGhost from '../../components/ui/ButtonGhost';

const AdminHome = ({ setView, logout }) => {
  const { showAlert } = useGlobalModal();
  const handleForceSaveID = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      showAlert({ message: '로그인 정보가 없습니다. 다시 로그인해 주세요.' });
      return;
    }
    const osId = OneSignal.User?.PushSubscription?.id;
    if (!osId) {
      showAlert({ message: 'OneSignal ID가 감지되지 않습니다. 알림 권한을 허용했는지 확인하세요.' });
      return;
    }
    const { error } = await supabase.from('profiles').update({ onesignal_id: osId }).eq('id', user.id);

    if (error) {
      showAlert({ message: 'DB 저장 실패: ' + error.message });
    } else {
      const { data: profile } = await supabase.from('profiles').select('onesignal_id').eq('id', user.id).single();
      const verified = profile?.onesignal_id === osId;
      showAlert({
        message: verified ? '성공! 관리자 알림 ID가 저장되었습니다: ' + osId : '저장 완료. (확인: ' + (profile?.onesignal_id || 'null') + ')',
      });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 flex flex-col relative pb-safe">
      <header className="p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif text-emerald-600">THE COACH</h2>
          <p className="text-gray-500 text-xs">Manager Mode</p>
        </div>
        <button onClick={logout}>
          <LogOut size={20} className="text-gray-600 hover:text-slate-900 transition-colors" />
        </button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-green-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <button
            onClick={() => setView('scanner')}
            className="relative w-48 h-48 rounded-full bg-white border border-gray-200 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
          >
            <Camera size={40} className="text-emerald-600" />
            <span className="text-sm tracking-widest font-medium text-gray-600">QR SCAN</span>
          </button>
        </div>
        <div className="w-full max-w-xs space-y-2 mt-8">
          <ButtonGhost onClick={() => setView('member_list')}>CLIENT LIST</ButtonGhost>
          <ButtonGhost onClick={() => setView('revenue')}>📅 DASHBOARD</ButtonGhost>
          <ButtonGhost onClick={() => setView('library')}>LIBRARY</ButtonGhost>
          <ButtonGhost onClick={() => setView('admin_settings')}>⚙️ SETTINGS</ButtonGhost>
          <button
            onClick={handleForceSaveID}
            className="w-full py-3 px-4 rounded-xl text-sm font-medium bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-emerald-600/30 transition-colors"
          >
            🔔 알림 연동 확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
