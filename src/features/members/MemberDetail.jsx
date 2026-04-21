import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, History, Plus, Calendar, Sparkles, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchSessionBalanceMetrics } from '../../utils/sessionHelpers';
import { SESSION_BALANCE_REFRESH_EVENT } from '../../utils/sessionBalanceEvents';
import BackButton from '../../components/ui/BackButton';
import AddSessionModal from './AddSessionModal';

const MemberDetail = ({ selectedMemberId, goBack }) => {
  const [u, setU] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  /** 잔여: 구매 합 − 출석 로그(유효 건만) — batch.remaining_count 미사용 */
  const [sessionBalance, setSessionBalance] = useState(null);
  /** null | 'add' | batch row — one modal with create vs edit */
  const [sessionModal, setSessionModal] = useState(null);

  const fetchMemberDetails = async () => {
    const { data: userData } = await supabase.from('profiles').select('*').eq('id', selectedMemberId).single();
    setU(userData);

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

  if (!u)
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center text-gray-500">Loading...</div>
    );

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 p-6 pb-20 relative">
      <BackButton onClick={goBack} />

      <header className="flex items-center justify-center mb-6">
        <h2 className="text-lg font-serif text-emerald-600">{u?.name}</h2>
      </header>

      <div className="space-y-6">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl border border-gray-200 relative overflow-hidden shadow-md">
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-gray-500 text-sm tracking-widest uppercase">Total Remaining</span>
              <span className="text-4xl font-serif text-emerald-600">{totalRemaining}</span>
            </div>
            <p className="text-gray-600 text-xs">{u.email}</p>
            {batches.length > 0 && (
              <p className="text-gray-600 text-xs mt-1">
                {batches.length} active ticket{batches.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard size={100} className="text-emerald-600" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History size={16} className="text-emerald-600" />
            Session Packs <span className="text-xs font-normal text-gray-500">(구매 건별 스냅샷)</span>
          </h3>

          {!loadingBatches && sessionBalance && sessionBalance.totalPurchased > 0 && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm text-slate-800">
              <span className="font-semibold tabular-nums">
                잔여 {sessionBalance.remaining} / 총 {sessionBalance.totalPurchased}회
              </span>
              <span className="text-gray-600 ml-2">· 출석 완료(COMPLETED) {sessionBalance.usedSessionCount}회</span>
            </div>
          )}

          {loadingBatches ? (
            <p className="text-gray-500 text-center py-6">Loading tickets...</p>
          ) : batches.length > 0 ? (
            <div className="space-y-3">
              {sessionBalance && sessionBalance.totalPurchased > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{
                      width: `${(sessionBalance.remaining / sessionBalance.totalPurchased) * 100}%`,
                    }}
                  />
                </div>
              )}
              {batches.map((batch, index) => {
                const isInUse = index === 0;
                const batchDate = new Date(batch.created_at)
                  .toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
                  .replace(/\. /g, '.')
                  .replace(/\.$/, '');

                return (
                  <div
                    key={batch.id}
                    className={`bg-white rounded-lg p-4 transition-all ${
                      isInUse ? 'border-2 border-emerald-600/60 bg-emerald-600/5' : 'border border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={14} className={isInUse ? 'text-emerald-600' : 'text-gray-500'} />
                          <span className="text-sm text-gray-500">{batchDate}</span>
                          {isInUse && (
                            <span className="text-xs bg-emerald-600 text-white font-bold px-2 py-0.5 rounded">IN USE</span>
                          )}
                        </div>

                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">🎫 구매</span>
                            <span className="text-lg font-bold text-slate-900">{batch.total_count}회</span>
                          </div>
                          <div className="h-10 w-px bg-gray-200"></div>
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">💰 Price</span>
                            <span className="text-lg font-serif text-emerald-600">
                              {(batch.price_per_session != null ? Number(batch.price_per_session) : 0).toLocaleString()}
                              <span className="text-xs ml-1">원</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSessionModal(batch)}
                        className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg px-3 py-2 transition-colors"
                        aria-label="세션 팩 수정"
                      >
                        <Pencil size={14} className="shrink-0" aria-hidden />
                        수정
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
              <CreditCard size={40} className="mx-auto mb-3 opacity-20 text-gray-400" />
              <p className="text-sm text-gray-600 mb-1">No detailed purchase history available</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Plus size={16} className="text-emerald-600" />
            Add New Session Pack
          </h3>

          <button
            onClick={() => setSessionModal('add')}
            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg text-sm hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50"
          >
            OPEN SESSION PACK FORM
          </button>

          <p className="text-xs text-gray-600 flex items-start gap-2">
            <Sparkles size={14} className="mt-0.5 flex-shrink-0" />
            <span>계산은 시스템이 자동으로 수행해 입력 실수를 방지합니다. (Remaining, Price/Session 자동 계산)</span>
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <div className="flex gap-8 sm:gap-12">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-gray-500 uppercase tracking-[0.2em] block mb-2">Birth</label>
              <p className="text-sm text-gray-800 font-light tracking-wide">{u.dob || '—'}</p>
            </div>
            <div className="w-px bg-gray-200 shrink-0 self-stretch min-h-[3rem]" aria-hidden />
            <div className="flex-1 min-w-0">
              <label className="text-xs text-gray-500 uppercase tracking-[0.2em] block mb-2">Gender</label>
              <p className="text-sm text-gray-800 font-light tracking-wide">{u.gender === 'M' ? 'Male' : 'Female'}</p>
            </div>
          </div>
        </div>
      </div>

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
