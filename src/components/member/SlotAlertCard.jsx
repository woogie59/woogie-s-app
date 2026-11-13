import React from 'react';
import { Bell, BellOff } from 'lucide-react';

/** Pure view shared with the isolated mobile fixture. Parent owns enrollment and cancellation. */
export default function SlotAlertCard({ time, registered, busy, onClick }) {
  return <button type="button" disabled={busy} onClick={onClick}
    className={`w-full rounded-xl border px-2 py-3 text-center flex flex-col items-center justify-center gap-1 min-h-20 ${registered ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-gray-50 text-gray-600'} disabled:opacity-60`}
    aria-label={`${time} ${registered ? '빈자리 알림 해제' : '빈자리 알림 받기'}`}>
    <span className="text-sm tabular-nums font-medium">{time}</span>
    <span className="flex items-center gap-1 text-[10px] leading-4 font-medium">
      {registered ? <BellOff size={12}/> : <Bell size={12}/>}
      {busy ? '처리 중…' : registered ? '알림 해제' : '빈자리 알림'}
    </span>
  </button>;
}
