import React, { useCallback, useEffect, useState } from 'react';
import { Crown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function HallOfFameHub({ setView, setSelectedMemberId, goBack }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingExams, setPendingExams] = useState([]);
  const [loadingPendingExams, setLoadingPendingExams] = useState(false);
  const [examActionBusyId, setExamActionBusyId] = useState('');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,member_level,current_title')
      .eq('role', 'user')
      .order('name', { ascending: true });
    setLoading(false);
    if (error) {
      console.error('[HallOfFameHub] profiles', error);
      setMembers([]);
      return;
    }
    setMembers(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const fetchPendingExams = useCallback(async () => {
    setLoadingPendingExams(true);
    try {
      // Step 1: fetch all columns so we can inspect the actual schema
      const { data: requests, error: reqErr } = await supabase
        .from('master_exam_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Always log raw data so admin can verify columns in console
      console.log('[HallOfFameHub] RAW REQUESTS:', requests, 'ERROR:', reqErr);

      if (reqErr) throw reqErr;

      const list = Array.isArray(requests) ? requests : [];

      // Step 2: immediately populate list with whatever we have so rows always show
      // Detect the actual user ID column name (user_id / member_id / applicant_id)
      const resolveUserId = (r) =>
        r.user_id ?? r.member_id ?? r.applicant_id ?? r.uid ?? null;

      // Render rows immediately without names so the list is never empty
      setPendingExams(
        list.map((r) => ({
          request_id: r.id,
          id: r.id,
          user_id: resolveUserId(r),
          name: resolveUserId(r) ?? 'ID 매칭 실패',
          created_at: r.created_at,
        }))
      );

      if (list.length === 0) return;

      // Step 3: enrich with real names via separate profiles query
      const userIds = [...new Set(list.map(resolveUserId).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      console.log('[HallOfFameHub] PROFILES:', profiles);

      const nameById = Object.fromEntries(
        (Array.isArray(profiles) ? profiles : []).map((p) => [p.id, p.name])
      );

      // Update list with real names — rows were already rendered above
      setPendingExams(
        list.map((r) => {
          const uid = resolveUserId(r);
          return {
            request_id: r.id,
            id: r.id,
            user_id: uid,
            name: (uid && nameById[uid]) ? nameById[uid] : (uid ?? 'ID 매칭 실패'),
            created_at: r.created_at,
          };
        })
      );
    } catch (e) {
      console.error('[HallOfFameHub] fetchPendingExams FAILED:', e);
      // Do NOT wipe list here — show whatever was already set
    } finally {
      setLoadingPendingExams(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingExams();
  }, [fetchPendingExams]);

  useEffect(() => {
    const ch = supabase
      .channel('hall-of-fame-exam-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_exam_requests' }, () => {
        void fetchPendingExams();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchPendingExams]);

  const approveExam = async (requestId) => {
    const id = String(requestId || '');
    if (!id) return;
    setExamActionBusyId(id);
    const { error } = await supabase.rpc('update_master_exam_status', {
      p_request_id: id,
      p_new_status: 'approved',
    });
    if (error) {
      toast.error(`승인 실패: ${error.message || String(error)}`);
      setExamActionBusyId('');
      return;
    }
    toast.success('마스터 심사를 승인했습니다.');
    setExamActionBusyId('');
    await fetchPendingExams();
  };

  const rejectExam = async (requestId) => {
    const id = String(requestId || '');
    if (!id) return;
    setExamActionBusyId(id);
    const { error } = await supabase.rpc('update_master_exam_status', {
      p_request_id: id,
      p_new_status: 'rejected',
    });
    if (error) {
      toast.error(`반려 실패: ${error.message || String(error)}`);
      setExamActionBusyId('');
      return;
    }
    toast.success('심사 요청을 반려했습니다.');
    setExamActionBusyId('');
    await fetchPendingExams();
  };

  return (
    <div className="min-h-[100dvh] bg-[#050505] px-6 py-8 text-white [font-family:Urbanist,sans-serif]">
      <button
        type="button"
        onClick={goBack}
        className="text-sm font-semibold tracking-wide text-zinc-400 transition hover:text-white"
      >
        {'< 돌아가기'}
      </button>

      <div className="mt-6 rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">아틀리트 명예의 전당</p>
        <p className="mt-2 text-sm text-zinc-500">다크 매터 컨트롤 허브에서 회원을 선택하세요.</p>
      </div>

      <div className="mt-6 rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">마스터 심사 대기열</p>
        {loadingPendingExams ? (
          <p className="mt-2 text-sm text-zinc-500">불러오는 중...</p>
        ) : pendingExams.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">대기 중인 마스터 심사가 없습니다.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pendingExams.map((req) => {
              const requestId = String(req.request_id || req.id || '');
              const pending = examActionBusyId === requestId;
              return (
                <div key={requestId} className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <p className="text-sm font-semibold text-zinc-100">{req?.name || req?.member_name || '회원'}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {req?.created_at ? new Date(req.created_at).toLocaleString('ko-KR') : ''}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => approveExam(requestId)}
                      className="rounded-lg border border-amber-300/35 bg-amber-900/25 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-800/30 disabled:opacity-40"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => rejectExam(requestId)}
                      className="rounded-lg border border-red-300/30 bg-red-950/20 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-900/30 disabled:opacity-40"
                    >
                      반려
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-zinc-500">표시할 회원이 없습니다.</p>
        ) : (
          members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelectedMemberId(m.id);
                sessionStorage.setItem('hall_of_fame_member_id', m.id);
                setView('hall_of_fame_member');
              }}
              className="w-full rounded-2xl border border-white/5 bg-zinc-900/40 p-4 text-left shadow-2xl backdrop-blur-xl transition hover:border-zinc-400/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-wide text-zinc-100">{m.name || '회원'}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    LV. {Number(m.member_level) || 1}
                    {m.current_title ? ` · ${m.current_title}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Crown size={14} />
                  <ChevronRight size={16} />
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

