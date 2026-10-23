import React, { useEffect, useRef, useState } from 'react';
import { invokeOtBlockGoogleSync } from '../../utils/googleCalendarOtSync';
import { supabase } from '../../lib/supabaseClient';

export default function OtCalendarActionDialog({ block, onClose, onChanged, onUnlinked, client = supabase, syncCalendar = invokeOtBlockGoogleSync }) {
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const lock = useRef(false);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setBooking(null); setConfirm(null);
    client.from('ot_bookings').select('id,name,date,time,status').eq('block_id', block.id)
      .in('status', ['confirmed', 'completed']).limit(2).then(({data,error:e}) => {
        if (!alive) return;
        if (!e && data?.length === 0 && onUnlinked) { onUnlinked(block); return; }
        if (e || data?.length !== 1) setError('연결된 오티 신청을 확인할 수 없습니다. 오티 신청 링크에서 확인해 주세요.');
        else setBooking(data[0]);
        setLoading(false);
      }).catch(() => { if (alive) { setError('오티 신청을 불러오지 못했습니다.'); setLoading(false); } });
    return () => { alive = false; };
  }, [block.id, client]);
  const run = async () => {
    if (lock.current || !booking || !confirm || booking.status !== 'confirmed') return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data, error: e } = await client.rpc(confirm === 'complete' ? 'ot_admin_complete' : 'ot_admin_cancel', {p_booking_id:booking.id});
      if (e || !data?.ok) throw Error('처리하지 못했습니다. 현재 신청 상태를 확인해 주세요.');
      if (confirm === 'cancel' && data.old_block) {
        try { await syncCalendar('DELETE', null, data.old_block); } catch (e) { console.warn('[ot] calendar unlink:', e); }
      }
      await onChanged?.(); onClose();
    } catch (e) { setError(e.message || '처리하지 못했습니다.'); }
    finally { lock.current=false; setBusy(false); setConfirm(null); }
  };
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="오티 수업 관리" onClick={() => !busy && onClose()}>
    <div className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl" onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between gap-3"><h2 className="text-lg font-semibold">오티 수업 관리</h2><button type="button" aria-label="닫기" disabled={busy} onClick={onClose}>닫기</button></div>
      <p className="mt-2 text-sm text-slate-500">{String(block.block_date).slice(0,10)} · {block.block_time}</p>
      {loading ? <p className="mt-5">신청 확인 중...</p> : booking ? <>
        <p className="mt-4 font-semibold">{booking.name}님 오티</p>
        {booking.status === 'completed' ? <p className="mt-4 rounded-xl bg-emerald-50 p-3">완료된 오티입니다.</p> : confirm ? <>
          <p className="mt-4 text-sm">{confirm === 'complete' ? '이 오티를 완료 처리할까요? 신청 횟수는 그대로 유지됩니다.' : '이 오티를 삭제(신청 취소)할까요? 자리는 열리고 신청 횟수는 돌아갑니다.'}</p>
          <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={busy} onClick={()=>setConfirm(null)} className="rounded-xl border p-3">돌아가기</button><button type="button" disabled={busy} onClick={run} className="rounded-xl bg-[#064e3b] p-3 text-white">{busy ? '처리 중...' : '확인'}</button></div>
        </> : <div className="mt-5 grid gap-3"><button type="button" onClick={()=>setConfirm('complete')} className="rounded-xl bg-[#064e3b] p-3 font-semibold text-white">수업 완료 처리</button><button type="button" onClick={()=>setConfirm('cancel')} className="rounded-xl border border-red-200 p-3 font-semibold text-red-700">수업 삭제 (신청 취소)</button></div>}
      </> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
    </div>
  </div>;
}
