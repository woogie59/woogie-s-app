import React, { useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

/**
 * 관리자 주간 캘린더의 '피티 등록 신청' 이벤트 다이얼로그 (2026-11-17 사용자 요청).
 * 승인은 검토 통과일 뿐 실제 예약은 자동으로 잡히지 않는다 (2026-10-23 합의 그대로).
 */
export default function PtRequestCalendarDialog({ request, onClose, onChanged, client = supabase }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'accepted' | 'declined'
  const [error, setError] = useState('');
  const lock = useRef(false);

  const name = String(request?.member_name || '').trim() || '회원';
  const date = String(request?.requested_date || '').slice(0, 10);
  const time = String(request?.requested_time || '');
  const status = request?.status;

  const run = async () => {
    if (lock.current || !confirm || status !== 'requested') return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const { data, error: e } = await client.rpc('ot_admin_pt_decide', { p_request_id: request.id, p_decision: confirm });
      if (e || !data?.ok) throw Error('처리하지 못했습니다. 현재 신청 상태를 확인해 주세요.');
      await onChanged?.();
      onClose();
    } catch (e2) {
      setError(e2.message || '처리하지 못했습니다.');
    } finally {
      lock.current = false;
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="피티 등록 신청" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between gap-3">
          <h2 className="text-lg font-semibold">피티 등록 신청</h2>
          <button type="button" aria-label="닫기" disabled={busy} onClick={onClose}>닫기</button>
        </div>
        <p className="mt-2 text-sm text-slate-500">{date} · {time}</p>
        <p className="mt-4 font-semibold">{name}님 피티 등록 신청</p>
        {status === 'accepted' ? (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm">승인된 신청입니다. 실제 수업 등록은 기존 예약 화면에서 진행해 주세요.</p>
        ) : confirm ? (
          <>
            <p className="mt-4 text-sm">
              {confirm === 'accepted'
                ? '이 신청을 승인할까요? 승인해도 예약은 자동으로 잡히지 않습니다. 실제 시간 확정은 기존 예약 화면에서 등록해 주세요.'
                : '이 신청을 거절할까요? 회원은 다시 신청할 수 있습니다.'}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" disabled={busy} onClick={() => setConfirm(null)} className="rounded-xl border p-3">돌아가기</button>
              <button type="button" disabled={busy} onClick={run} className="rounded-xl bg-[#064e3b] p-3 text-white">{busy ? '처리 중...' : '확인'}</button>
            </div>
          </>
        ) : (
          <div className="mt-5 grid gap-3">
            <button type="button" onClick={() => setConfirm('accepted')} className="rounded-xl bg-[#064e3b] p-3 font-semibold text-white">신청 승인</button>
            <button type="button" onClick={() => setConfirm('declined')} className="rounded-xl border border-red-200 p-3 font-semibold text-red-700">신청 거절</button>
          </div>
        )}
        {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
