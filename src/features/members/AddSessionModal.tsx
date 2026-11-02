import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import {
  computeRemainingSessions,
  countCompletedAttendanceLogs,
  sumTotalPurchasedFromBatches,
} from '../../utils/sessionHelpers';
import {
  buildMonthPickerOptions,
  currentMonthPickerValue,
  dateToMonthPickerValue,
  monthPickerValueToDate,
} from '../../utils/monthPickerOptions';

/** Row from `session_batches` — purchase snapshot */
export type SessionBatchRow = {
  id: string;
  total_count: number;
  remaining_count: number;
  price_per_session: number;
  price?: number | null;
  sales_applied_month?: string | null;
  created_at?: string | null;
};

type Props = {
  userId: string;
  onClose: () => void;
  onSaved?: () => void;
  mode?: 'create' | 'edit';
  editBatch?: SessionBatchRow | null;
  currentMembershipEnd?: string | null;
};

const clampInt = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
};

type NumericInput = '' | string;

const toNumericInput = (n: unknown): NumericInput => {
  const v = clampInt(n);
  return v === 0 ? '' : String(v);
};

const toNumberOrZero = (v: NumericInput) => (v === '' ? 0 : clampInt(v));

export default function AddSessionModal({
  userId,
  onClose,
  onSaved,
  mode = 'create',
  editBatch = null,
  currentMembershipEnd = null,
}: Props) {
  const { showAlert } = useGlobalModal();

  const defaults =
    mode === 'edit' && editBatch
      ? {
          totalSessions: toNumericInput(editBatch.total_count),
          pricePerSession: toNumericInput(editBatch.price_per_session),
          salesAppliedMonth: dateToMonthPickerValue(
            editBatch.sales_applied_month || editBatch.created_at,
          ),
        }
      : {
          totalSessions: '' as NumericInput,
          pricePerSession: '' as NumericInput,
          salesAppliedMonth: currentMonthPickerValue(),
        };

  const [totalSessions, setTotalSessions] = useState<NumericInput>(defaults.totalSessions);
  const [pricePerSession, setPricePerSession] = useState<NumericInput>(defaults.pricePerSession);
  const [salesAppliedMonth, setSalesAppliedMonth] = useState(defaults.salesAppliedMonth);
  const [membershipEnd, setMembershipEnd] = useState(currentMembershipEnd || '');
  const [saving, setSaving] = useState(false);
  /** 생성 모드 재시도/중복 탭 시 배치 중복 insert 방지 (같은 모달 세션 내) */
  const createdBatchIdRef = useRef<string | null>(null);
  /** 생성 모드 배치의 미리 배정된 id — 응답 유실 후 재시도 시 같은 id로 보내 PK 충돌(23505)이면 '이미 생성됨'으로 이어짐 */
  const pendingBatchIdRef = useRef<string | null>(null);

  /** 진행 중인 등록 작업의 내구 토큰 — uuid 하나만 보관 (회원·금액 등 어떤 개인/이용 정보도 저장하지 않음) */
  const PENDING_KEY = 'labdot:pending-session-batch';
  const storageOkRef = useRef<boolean>(true);
  const readPendingId = (): string | null => {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return raw && typeof raw === 'string' ? raw : null;
    } catch {
      return null;
    }
  };
  const clearPendingOp = () => {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  };

  /** 잔여 횟수를 진실 기준(Σ총횟수 − 완료 출석) 절대값으로 맞춤 — 단가를 알 때만 함께 반영 */
  const reconcileRemaining = async (pps: number | null) => {
    const [batchesRes, logsRes] = await Promise.all([
      supabase.from('session_batches').select('total_count').eq('user_id', userId),
      supabase.from('attendance_logs').select('status').eq('user_id', userId),
    ]);
    if (batchesRes.error) throw batchesRes.error;
    if (logsRes.error) throw logsRes.error;
    const absoluteRemaining = computeRemainingSessions(
      sumTotalPurchasedFromBatches(batchesRes.data || []),
      countCompletedAttendanceLogs(logsRes.data || []),
    );
    const payload: Record<string, number> = { remaining_sessions: absoluteRemaining };
    if (pps != null) payload.price_per_session = pps;
    const { error: profileUpdateError } = await supabase.from('profiles').update(payload).eq('id', userId);
    if (profileUpdateError) throw profileUpdateError;
  };

  // 생성 모드 진입 시 미완료 등록 조율 (토큰은 uuid만): 반영됐으면 잔여까지 맞추고 새로 만들지 않음, 미반영이면 같은 id만 채택하고 입력은 새로
  useEffect(() => {
    try {
      localStorage.setItem('labdot:probe', '1');
      localStorage.removeItem('labdot:probe');
    } catch {
      storageOkRef.current = false;
    }
    if (mode !== 'create' || !userId || !storageOkRef.current) return;
    const pendingId = readPendingId();
    if (!pendingId) return;
    void (async () => {
      const { data, error } = await supabase
        .from('session_batches')
        .select('user_id')
        .eq('id', pendingId)
        .maybeSingle();
      if (error) return; // 조회 불가 — 토큰 유지, 다음 진입에 다시 조율
      if (data) {
        if (data.user_id !== userId) {
          // 다른 회원의 미완료 작업 — 토큰은 그 회원을 위해 보존, 이 모달은 닫음
          showAlert({
            title: '등록 확인 필요',
            message: '다른 회원의 미완료 등록이 있습니다. 해당 회원의 상세 화면에서 확인해 주세요.',
          });
          onClose();
          return;
        }
        try {
          await reconcileRemaining(null);
        } catch (reconcileErr) {
          // 잔여 반영 실패를 성공으로 보고하지 않음 — 토큰 유지, 다음 진입에 다시 맞춤
          console.error('AddSessionModal reconcile error:', reconcileErr);
          showAlert({
            title: '잔여 반영 실패',
            message: '수강권은 이미 반영되어 있지만 잔여 횟수 반영에 실패했습니다. 이 화면을 다시 열면 다시 맞춥니다.',
          });
          onSaved?.();
          onClose();
          return;
        }
        clearPendingOp();
        showAlert({
          title: '등록 확인',
          message: '이전에 등록 중이던 수강권이 이미 반영되어 있습니다. 잔여 횟수도 맞춰 두었습니다.',
        });
        onSaved?.();
        onClose();
      } else {
        pendingBatchIdRef.current = pendingId; // uuid만 채택 — 횟수·단가 등 입력은 새로 받음
        showAlert({ message: '완료되지 않은 이전 등록이 있습니다. 내용을 다시 입력하고 저장하면 같은 등록으로 이어집니다.' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthOptions = useMemo(() => buildMonthPickerOptions(), []);

  /** 수정 시 이미 사용된 횟수 — 입력란 없이 배치에서만 계산 */
  const usedFromBatch =
    mode === 'edit' && editBatch ? Math.max(0, editBatch.total_count - editBatch.remaining_count) : 0;

  const { error } = useMemo(() => {
    const totalSessionsN = toNumberOrZero(totalSessions);
    const pricePerSessionN = toNumberOrZero(pricePerSession);
    let err = '';
    if (!userId) err = '회원 정보가 없습니다.';
    else if (totalSessionsN < 1) err = '횟수는 1 이상이어야 합니다.';
    else if (usedFromBatch > totalSessionsN) err = '횟수는 이미 사용된 횟수보다 작을 수 없습니다.';
    else if (pricePerSessionN < 0) err = '회당 단가는 0 이상이어야 합니다.';
    else if (!monthPickerValueToDate(salesAppliedMonth)) err = '매출 적용 월을 선택해 주세요.';
    return { error: err };
  }, [totalSessions, pricePerSession, salesAppliedMonth, membershipEnd, userId, usedFromBatch]);

  const handleSave = async () => {
    if (error) {
      showAlert({ title: '입력 확인', message: error });
      return;
    }
    setSaving(true);
    const nextEnd = membershipEnd || null;
    const wantsPeriodUpdate = !!nextEnd && nextEnd !== (currentMembershipEnd || null);
    let periodSaved = false;
    let step: 'period' | 'batch' | 'remaining' = wantsPeriodUpdate ? 'period' : 'batch';
    try {
      // 1) 회원권 기간 먼저 — 실패 시 다른 쓰기 없음, 재시도 안전
      if (wantsPeriodUpdate) {
        const { error: membershipError } = await supabase
          .from('profiles')
          .update({ membership_end: nextEnd })
          .eq('id', userId);
        if (membershipError) throw membershipError;
        periodSaved = true;
      }

      // 2) 수강권 배치 — 생성은 모달 세션당 1회만 insert (재시도·중복 탭 안전), 수정은 절대값 갱신이라 멱등
      step = 'batch';
      const totalSessionsN = toNumberOrZero(totalSessions);
      const pricePerSessionN = toNumberOrZero(pricePerSession);
      const newRemaining = Math.max(0, totalSessionsN - usedFromBatch);
      const packPrice = totalSessionsN * pricePerSessionN;
      const salesAppliedMonthDate = monthPickerValueToDate(salesAppliedMonth);

      if (mode === 'edit' && editBatch) {
        const { error: updateError } = await supabase
          .from('session_batches')
          .update({
            total_count: totalSessionsN,
            remaining_count: newRemaining,
            price_per_session: pricePerSessionN,
            price: packPrice,
            sales_applied_month: salesAppliedMonthDate,
          })
          .eq('id', editBatch.id);
        if (updateError) throw updateError;
      } else if (!createdBatchIdRef.current) {
        if (!storageOkRef.current)
          throw new Error('브라우저 저장소를 사용할 수 없어 안전한 중복 방지가 불가합니다. 브라우저 설정을 확인해 주세요.');
        if (!pendingBatchIdRef.current) pendingBatchIdRef.current = crypto.randomUUID();
        const pendingId = pendingBatchIdRef.current;
        const existingToken = readPendingId();
        if (existingToken && existingToken !== pendingId)
          throw new Error('다른 등록 작업이 진행 중입니다. 수강권 내역을 확인한 뒤 다시 시도해 주세요.');
        try {
          localStorage.setItem(PENDING_KEY, pendingId);
        } catch {
          throw new Error('브라우저 저장소를 사용할 수 없어 안전한 중복 방지가 불가합니다. 브라우저 설정을 확인해 주세요.');
        }
        const { data: inserted, error: insertError } = await supabase
          .from('session_batches')
          .insert({
            id: pendingId,
            user_id: userId,
            total_count: totalSessionsN,
            remaining_count: newRemaining,
            price_per_session: pricePerSessionN,
            price: packPrice,
            sales_applied_month: salesAppliedMonthDate,
          })
          .select('id')
          .single();
        if (insertError) {
          const code = (insertError as { code?: string }).code;
          const msg = String(insertError.message || '');
          const isConflict = code === '23505' || msg.includes('duplicate key');
          if (!isConflict) throw insertError;
          // 충돌 행이 우리가 미리 배정한 바로 그 작업인지 내용까지 확인 — 아니면 실패로 닫음 (다른 유니크 충돌 삼키지 않음)
          const { data: existing, error: fetchErr } = await supabase
            .from('session_batches')
            .select('user_id, total_count, price_per_session, sales_applied_month')
            .eq('id', pendingId)
            .maybeSingle();
          if (fetchErr) throw fetchErr;
          const matches =
            !!existing &&
            existing.user_id === userId &&
            Number(existing.total_count) === totalSessionsN &&
            Number(existing.price_per_session) === pricePerSessionN &&
            String(existing.sales_applied_month || '') === String(salesAppliedMonthDate || '');
          if (!matches) throw new Error('동일한 등록 키의 다른 수강권이 있습니다. 수강권 내역을 확인해 주세요.');
        }
        createdBatchIdRef.current = inserted?.id ?? pendingId;
        clearPendingOp();
      }

      // 3) 잔여 횟수 — 델타가 아니라 진실 기준(Σ총횟수 − 완료 출석) 절대값으로 재계산: 어떤 재시도도 중복 적립 없음
      step = 'remaining';
      await reconcileRemaining(pricePerSessionN);

      showAlert({ message: mode === 'edit' ? '수강권이 수정되었습니다.' : '수강권이 등록되었습니다.' });
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      console.error('AddSessionModal save error:', e);
      // 진행된 단계를 정확히 알림 — 부분 성공을 전체 실패처럼 보고하지 않음
      let msg: string;
      if (step === 'remaining') {
        msg = '수강권은 저장됐지만 잔여 횟수 반영에 실패했습니다. 다시 저장하면 이어서 반영됩니다.';
      } else if (step === 'batch' && mode === 'create') {
        // insert 오류는 서버 반영 여부가 불확실 — 목록 확인을 안내해 모르며 중복 등록하는 사고 방지
        const em = e instanceof Error ? e.message : '';
        msg =
          em.includes('동일한 등록 키') || em.includes('브라우저 저장소') || em.includes('다른 등록 작업')
            ? em
            : '수강권 등록에 실패했습니다. 네트워크 오류 시 이미 등록됐을 수 있으니, 수강권 내역을 확인한 뒤 다시 시도해 주세요.';
      } else if (step === 'batch') {
        msg = '수강권 수정에 실패했습니다. 다시 저장해 주세요.';
      } else {
        msg = '회원권 기간 저장에 실패했습니다. 다시 저장해 주세요.';
      }
      if (periodSaved) msg = `회원권 기간은 저장됐습니다. ${msg}`;
      showAlert({ title: '저장 실패', message: msg });
      // 실패 시에도 하단 화면 데이터를 새로고침 — 서버에 반영됐을 수 있는 변경이 목록에 정확히 보이도록
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm bg-white px-8 py-10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-start justify-between gap-4 mb-10">
          <h3 className="text-lg font-semibold text-neutral-900 tracking-tight">
            {mode === 'edit' ? '수강권 수정' : '수강권 등록'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors"
            aria-label="닫기"
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-8">
          <div>
            <label htmlFor="total-sessions" className="block text-sm font-medium text-neutral-800 mb-2">
              횟수 (Total Sessions)
            </label>
            <input
              id="total-sessions"
              type="number"
              inputMode="numeric"
              min={1}
              className="w-full border-0 border-b border-neutral-900/20 bg-transparent py-2 text-xl font-semibold tabular-nums text-neutral-950 outline-none focus:border-neutral-900 transition-colors"
              value={totalSessions}
              onChange={(e) => setTotalSessions(e.target.value === '' ? '' : String(clampInt(e.target.value)))}
              placeholder="0"
            />
          </div>

          <div>
            <label htmlFor="price-per-session" className="block text-sm font-medium text-neutral-800 mb-2">
              회당 단가 (Price per Session)
            </label>
            <input
              id="price-per-session"
              type="number"
              inputMode="numeric"
              min={0}
              className="w-full border-0 border-b border-neutral-900/20 bg-transparent py-2 text-xl font-semibold tabular-nums text-neutral-950 outline-none focus:border-neutral-900 transition-colors"
              value={pricePerSession}
              onChange={(e) => setPricePerSession(e.target.value === '' ? '' : String(clampInt(e.target.value)))}
              placeholder="0"
            />
            <p className="mt-2 text-xs text-neutral-500">원 · 회당</p>
          </div>

          <div>
            <label htmlFor="sales-applied-month" className="block text-sm font-medium text-neutral-800 mb-2">
              매출 적용 월
            </label>
            <select
              id="sales-applied-month"
              value={salesAppliedMonth}
              onChange={(e) => setSalesAppliedMonth(e.target.value)}
              className="w-full border-0 border-b border-neutral-900/20 bg-transparent py-2.5 text-lg font-semibold text-neutral-950 outline-none focus:border-neutral-900 transition-colors cursor-pointer appearance-none"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-neutral-500">페이롤 매출 시트에 반영할 월</p>
          </div>

          <div>
            <label htmlFor="session-membership-end" className="block text-sm font-medium text-neutral-800 mb-2">
              회원권 만료일 (선택)
            </label>
            <input
              id="session-membership-end"
              type="date"
              value={membershipEnd}
              onChange={(e) => setMembershipEnd(e.target.value)}
              className="w-full border-0 border-b border-neutral-900/20 bg-transparent py-2 text-base font-semibold text-neutral-950 outline-none focus:border-neutral-900 transition-colors"
            />
            <p className="mt-2 text-xs text-neutral-500">비워 두면 기존 만료일이 유지됩니다.</p>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={handleSave}
            disabled={!!error || saving}
            className="w-full mt-4 bg-neutral-950 text-white text-[15px] font-semibold py-3.5 tracking-wide hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {saving ? '처리 중…' : mode === 'edit' ? '저장' : '수강권 등록'}
          </button>
        </div>
      </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
