import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchSessionBalanceMetrics } from '../../utils/sessionHelpers';
import { SESSION_BALANCE_REFRESH_EVENT } from '../../utils/sessionBalanceEvents';
import BackButton from '../../components/ui/BackButton';
import AddSessionModal from './AddSessionModal';

const MemberDetail = ({ selectedMemberId, goBack }) => {
  const [u, setU] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [sessionBalance, setSessionBalance] = useState(null);
  const [sessionModal, setSessionModal] = useState(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [isMemoEditing, setIsMemoEditing] = useState(false);
  const [isMemoSaving, setIsMemoSaving] = useState(false);
  const [memoSavedFlash, setMemoSavedFlash] = useState(false);

  const fetchMemberDetails = async () => {
    const { data: userData } = await supabase.from('profiles').select('*').eq('id', selectedMemberId).single();
    setU(userData);
    setMemoDraft(userData?.memo || '');

    setLoadingBatches(true);
    const [batchRes, balanceRes] = await Promise.all([
      supabase
        .from('session_batches')
        .select('*')
        .eq('user_id', selectedMemberId)
        .order('created_at', { ascending: true }),
      fetchSessionBalanceMetrics(supabase, selectedMemberId),
    ]);

    if (batchRes.error) {
      console.error('Error fetching batches:', batchRes.error);
      setBatches([]);
    } else {
      setBatches(batchRes.data || []);
    }
    setSessionBalance(balanceRes);

    setLoadingBatches(false);
  };

  useEffect(() => {
    fetchMemberDetails();
  }, [selectedMemberId]);

  const reloadBalanceOnly = useCallback(async () => {
    const m = await fetchSessionBalanceMetrics(supabase, selectedMemberId);
    setSessionBalance(m);
  }, [selectedMemberId]);

  useEffect(() => {
    const onEvt = () => {
      void reloadBalanceOnly();
    };
    window.addEventListener(SESSION_BALANCE_REFRESH_EVENT, onEvt);
    return () => window.removeEventListener(SESSION_BALANCE_REFRESH_EVENT, onEvt);
  }, [reloadBalanceOnly]);

  useEffect(() => {
    if (!selectedMemberId) return;
    const uid = selectedMemberId;
    const schedule = () => {
      void reloadBalanceOnly();
    };
    const ch = supabase
      .channel(`member_detail_balance_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs', filter: `user_id=eq.${uid}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_batches', filter: `user_id=eq.${uid}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${uid}` }, schedule)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedMemberId, reloadBalanceOnly]);

  const totalRemaining = sessionBalance?.remaining ?? 0;

  const saveMemoIfChanged = useCallback(async () => {
    if (!u?.id) return;
    const prev = u.memo || '';
    const next = memoDraft.trim();
    if (prev === next) {
      setIsMemoEditing(false);
      return;
    }
    setIsMemoSaving(true);
    const { error } = await supabase.from('profiles').update({ memo: next }).eq('id', u.id);
    setIsMemoSaving(false);
    setIsMemoEditing(false);
    if (error) {
      console.error('Error saving trainer memo:', error);
      return;
    }
    setU((prevU) => (prevU ? { ...prevU, memo: next } : prevU));
    setMemoSavedFlash(true);
    window.setTimeout(() => setMemoSavedFlash(false), 1200);
  }, [u, memoDraft]);

  if (!u)
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center text-neutral-400 text-sm">불러오는 중…</div>
    );

  return (
    <div className="min-h-[100dvh] bg-white text-neutral-950 px-6 py-10 pb-24 max-w-lg mx-auto">
      <BackButton onClick={goBack} />

      <header className="mt-8 mb-12">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">{u?.name || '—'}</h1>
        <p className="mt-2 text-sm text-neutral-500">{u.email}</p>
      </header>

      <section className="mb-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 mb-3">잔여 세션</p>
        <p className="text-5xl font-semibold tabular-nums text-neutral-950 tracking-tight">{totalRemaining}</p>
      </section>

      <section className="mb-16">
        <div className="flex items-baseline justify-between gap-4 mb-8">
          <h2 className="text-base font-semibold text-neutral-950">수강권 내역</h2>
          <button
            type="button"
            onClick={() => setSessionModal('add')}
            className="text-sm font-medium text-neutral-950 underline underline-offset-4 decoration-neutral-300 hover:decoration-neutral-950"
          >
            + 수강권 추가
          </button>
        </div>

        {!loadingBatches && sessionBalance && sessionBalance.totalPurchased > 0 && (
          <p className="text-sm text-neutral-600 mb-8 leading-relaxed">
            잔여 {sessionBalance.remaining} / 총 {sessionBalance.totalPurchased}회 · 출석 {sessionBalance.usedSessionCount}회
          </p>
        )}

        {loadingBatches ? (
          <p className="text-sm text-neutral-400">불러오는 중…</p>
        ) : batches.length > 0 ? (
          <ul className="space-y-10">
            {batches.map((batch) => {
              const batchDate = new Date(batch.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });
              const pps = batch.price_per_session != null ? Number(batch.price_per_session) : 0;
              return (
                <li key={batch.id} className="border-t border-neutral-200 pt-8 first:border-0 first:pt-0">
                  <p className="text-xs text-neutral-400 mb-4">{batchDate}</p>
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-medium tabular-nums text-neutral-950">{batch.total_count}회</span>
                    <span className="text-sm text-neutral-500 tabular-nums">회당 {pps.toLocaleString()}원</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSessionModal(batch)}
                    className="mt-4 text-sm font-medium text-neutral-950 border-b border-neutral-950 pb-0.5"
                  >
                    수정
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">등록된 수강권이 없습니다.</p>
        )}
      </section>

      <section className="mb-14">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-500">트레이너 메모</h2>
          <span
            className={`text-xs text-emerald-700 transition-opacity duration-300 ${
              memoSavedFlash ? 'opacity-100' : 'opacity-0'
            }`}
          >
            저장됨
          </span>
        </div>
        {isMemoEditing ? (
          <textarea
            value={memoDraft}
            onChange={(e) => setMemoDraft(e.target.value)}
            onBlur={saveMemoIfChanged}
            placeholder="직업, 부상 이력, 특이사항을 기록하세요. (터치하여 편집)"
            className="w-full min-h-[132px] rounded-lg bg-gray-50 p-4 text-sm text-gray-800 placeholder:text-gray-400 outline-none"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsMemoEditing(true)}
            className="w-full min-h-[132px] rounded-lg bg-gray-50 p-4 text-left text-sm text-gray-800 transition-colors hover:bg-gray-100"
          >
            {u?.memo?.trim() ? (
              <p className="whitespace-pre-wrap leading-relaxed">{u.memo}</p>
            ) : (
              <p className="text-gray-400">직업, 부상 이력, 특이사항을 기록하세요. (터치하여 편집)</p>
            )}
          </button>
        )}
        {isMemoSaving && <p className="mt-2 text-xs text-gray-400">저장 중...</p>}
      </section>

      <section className="border-t border-neutral-200 pt-12">
        <h2 className="sr-only">회원 정보</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 text-sm">
          <div>
            <dt className="text-neutral-400 mb-1">생년월일</dt>
            <dd className="text-neutral-950 font-medium">{u.dob || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-400 mb-1">성별</dt>
            <dd className="text-neutral-950 font-medium">{u.gender === 'M' ? '남' : u.gender === 'F' ? '여' : '—'}</dd>
          </div>
        </dl>
      </section>

      {sessionModal && (
        <AddSessionModal
          key={typeof sessionModal === 'object' && sessionModal?.id ? sessionModal.id : 'new-pack'}
          userId={selectedMemberId}
          mode={typeof sessionModal === 'object' ? 'edit' : 'create'}
          editBatch={typeof sessionModal === 'object' ? sessionModal : null}
          onClose={() => setSessionModal(null)}
          onSaved={fetchMemberDetails}
        />
      )}
    </div>
  );
};

export default MemberDetail;
