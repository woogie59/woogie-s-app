import React from 'react';
import BackButton from '../../components/ui/BackButton';
import AdminBookingSettingsPanel from '../../features/admin/AdminBookingSettingsPanel';

const AdminSettings = ({ goBack }) => {
  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 p-6 pb-24 relative">
      <BackButton onClick={goBack} />
      <h2 className="text-2xl font-bold text-emerald-600 mb-2">예약 설정</h2>
      <p className="text-sm text-gray-500 mb-6">시간 블록을 켜면 예약 가능합니다. (00:00–23:00)</p>
      <AdminBookingSettingsPanel variant="page" />
    </div>
  );
};

export default AdminSettings;
