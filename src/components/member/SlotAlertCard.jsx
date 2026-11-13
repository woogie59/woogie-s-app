import React from 'react';
import { Bell, BellOff } from 'lucide-react';

/** A closed slot stays visibly closed; the bell is only an alert action. */
export default function SlotAlertCard({ time, registered, busy, onClick }) {
  return <button type="button" disabled={busy} onClick={onClick}
    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-2 py-3 text-center flex flex-col items-center justify-center gap-1 min-h-20 disabled:opacity-60 cursor-pointer"
    style={{ backgroundImage: 'linear-gradient(to bottom right, transparent calc(50% - 0.5px), #d1d5db calc(50% - 0.5px), #d1d5db calc(50% + 0.5px), transparent calc(50% + 0.5px))' }}
    aria-pressed={registered}
    aria-label={`${time} ${registered ? '빈자리 알림 해제' : '빈자리 알림 받기'}`}>
    <span className="text-sm tabular-nums font-medium text-gray-400">{time}</span>
    <span className="flex items-center gap-1 bg-gray-50 px-1 text-[10px] leading-4 font-medium text-gray-600">
      {registered ? <BellOff size={12}/> : <Bell size={12}/>}
      {busy ? '처리 중…' : registered ? '마감 · 알림 해제' : '마감 · 알림'}
    </span>
  </button>;
}
