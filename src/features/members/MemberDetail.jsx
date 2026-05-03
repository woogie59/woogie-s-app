import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchSessionBalanceMetrics } from '../../utils/sessionHelpers';
import { SESSION_BALANCE_REFRESH_EVENT } from '../../utils/sessionBalanceEvents';
import BackButton from '../../components/ui/BackButton';
import AddSessionModal from './AddSessionModal';
import MemberStatusTab from './MemberStatusTab';

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
  const [detailTab, setDetailTab] = useState('overview');
  const [memberStats, setMemberStats] = useState([]);

  const fetchMemberStats = useCallback(async () => {
    if (!selectedMemberId) return;
    const { data, error } = await supabase
      .from('member_stats')
      .select('*')
      .eq('user_id', selectedMemberId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching member_stats:', error);
      setMemberStats([]);
    } else {
      setMemberStats(data || []);
    }
  }, [selectedMemberId]);

  const fetchMemberDetails = async () => {
    const { data: userData } = await supabase.from('profiles').select('*').eq('id', selectedMemberId).single();
    setU(userData);
    setMemoDraft(userData?.memo || '');

    setLoadingBatches(true);
    const [batchRes, balanceRes, statsRes] = await Promise.all([
      supabase
        .from('session_batches')
        .select('*')
        .eq('user_id', selectedMemberId)
        .order('created_at', { ascending: true }),
      fetchSessionBalanceMetrics(supabase, selectedMemberId),
      supabase.from('member_stats').select('*').eq('user_id', selectedMemberId).order('created_at', { ascending: true }),
    ]);

    if (batchRes.error) {
      console.error('Error fetching batches:', batchRes.error);
      setBatches([]);
    } else {
      setBatches(batchRes.data || []);
    }
    setSessionBalance(balanceRes);

    if (statsRes.error) {
      console.error('Error fetching member_stats:', statsRes.error);
      setMemberStats([]);
    } else {
      setMemberStats(statsRes.data || []);
    }

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
  const totalPurchased = sessionBalance?.totalPurchased ?? 0;
  const usedSessionCount = sessionBalance?.usedSessionCount ?? 0;
  const progressPct = totalPurchased > 0 ? Math.min(100, (usedSessionCount / totalPurchased) * 100) : 0;

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

      <header className="mt-8 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">{u?.name || '—'}</h1>
        <p className="mt-2 text-sm text-neutral-500">{u.email}</p>
      </header>

      <div className="mb-10 flex rounded-xl bg-neutral-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setDetailTab('overview')}
          className={`flex-1 rounded-lg py-2.5 transition-colors ${
            detailTab === 'overview' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          개요
        </button>
        <button
          type="button"
          onClick={() => setDetailTab('status')}
          className={`flex-1 rounded-lg py-2.5 transition-colors ${
            detailTab === 'status' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          스테이터스 관리
        </button>
      </div>

      {detailTab === 'status' ? (
        <MemberStatusTab
          userId={selectedMemberId}
          profile={u}
          stats={memberStats}
          memberLevel={u?.member_level ?? 1}
          onRefresh={async () => {
            await fetchMemberStats();
            const { data: userData } = await supabase.from('profiles').select('*').eq('id', selectedMemberId).single();
            if (userData) setU(userData);
          }}
        />
      ) : null}

      {detailTab === 'overview' && (
        <>
      <section className="mb-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 mb-3">잔여 세션</p>
        <p className="text-5xl font-semibold tabular-nums text-neutral-950 tracking-tight">{totalRemaining}</p>
      </section>

      <section className="mb-16">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-base font-semibold text-neutral-950">수강권 내역</h2>
          <button
            type="button"
            onClick={() => setSessionModal('add')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#064e3b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#053d2f] transition-colors"
          >
            <Plus size={14} />
            수강권 추가
          </button>
        </div>

        {!loadingBatches && (
          <div className="mb-8 rounded-2xl bg-gradient-to-br from-[#0b5a45] to-[#064e3b] p-5 text-white shadow-lg">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-emerald-100/80">총 횟수</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{totalPurchased}</p>
              </div>
              <div>
                <p className="text-[11px] text-emerald-100/80">진행</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{usedSessionCount}</p>
              </div>
              <div>
                <p className="text-[11px] text-emerald-100/80">잔여</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{totalRemaining}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] text-emerald-100/80">진행률</span>
                <span className="text-xs font-semibold tabular-nums">{Math.round(progressPct)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
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
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-[#064e3b]/40 hover:text-[#064e3b] transition-colors"
                  >
                    <Settings2 size={14} />
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
        </>
      )}

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
