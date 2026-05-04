import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { motion as Motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { invokeNotifyMemberEvents } from '../../utils/notifications';
import AthleteStatus from './AthleteStatus';
import GrowthLedgerTimeline from './GrowthLedgerTimeline';
import MemberPhoneMirror from './MemberPhoneMirror';

const PHYSICAL_AUTONOMY_MAX = 10;
const CORE_STATS = [
  'Movement IQ (운동 지능)',
  'Mobility (가동성)',
  'Strength (절대 근력)',
  'Metabolic (대사 능력)',
  'Resilience (수행 심리)',
];
const CORE_STAT_SET = new Set(CORE_STATS);
const CORE_STAT_INDEX = new Map(CORE_STATS.map((name, idx) => [name, idx]));

function totalExpFloorBonus(stats, pendingExp) {
  return stats.reduce((acc, s) => {
    const v = pendingExp[s.id] ?? (Number(s.exp_percent) || 0);
    return acc + Math.floor(v / 100);
  }, 0);
}

function supabaseErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'object' && error !== null) {
    const bits = [error.message, error.details, error.hint].filter(Boolean);
    if (bits.length) return bits.join(' — ');
  }
  return String(error);
}

const LEDGER_PAGE_SIZE = 60;

function MemberSimulatorLedger({ memberId, refreshKey }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!memberId) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('exp_logs')
        .select('*')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(LEDGER_PAGE_SIZE);
      if (cancelled) return;
      setLoading(false);
      if (error) {
        console.error('[MemberSimulatorLedger] exp_logs', error);
        setEntries([]);
        return;
      }
      setEntries(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId, refreshKey]);

  return <GrowthLedgerTimeline entries={entries} loading={loading} />;
}

export default function MemberStatusTab({ userId, profile, stats, memberLevel, onRefresh, onMemberLevelSynced }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualLevelDraft, setManualLevelDraft] = useState('');
  const [pendingExp, setPendingExp] = useState(() =>
    Object.fromEntries((stats || []).map((s) => [s.id, Math.round(Number(s.exp_percent) * 10) / 10]))
  );
  const [committedExpByStatId, setCommittedExpByStatId] = useState(() =>
    Object.fromEntries((stats || []).map((s) => [s.id, Number(s.exp_percent) || 0]))
  );
  const [committedMemberLevel, setCommittedMemberLevel] = useState(() => {
    const n = Number(memberLevel);
    return Number.isFinite(n) ? Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n)) : 1;
  });
  const [epicKey, setEpicKey] = useState(0);
  const [achievementReasonByStatId, setAchievementReasonByStatId] = useState({});
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);

  const prevBonusRef = useRef(null);

  useEffect(() => {
    setPendingExp(Object.fromEntries((stats || []).map((s) => [s.id, Math.round(Number(s.exp_percent) * 10) / 10])));
  }, [stats]);

  useEffect(() => {
    setCommittedExpByStatId(Object.fromEntries((stats || []).map((s) => [s.id, Number(s.exp_percent) || 0])));
  }, [stats]);

  useEffect(() => {
    const n = Number(memberLevel);
    setCommittedMemberLevel(Number.isFinite(n) ? Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n)) : 1);
  }, [memberLevel, userId]);

  useEffect(() => {
    setAchievementReasonByStatId((prev) => {
      const next = { ...prev };
      for (const s of stats || []) {
        if (next[s.id] === undefined) {
          next[s.id] = s.achievement_note != null ? String(s.achievement_note) : '';
        }
      }
      return next;
    });
  }, [stats]);

  const displayName = profile?.name || '회원';

  const sortedStats = useMemo(
    () =>
      [...(stats || [])]
        .filter((s) => CORE_STAT_SET.has(String(s.category_name || '').trim()))
        .sort((a, b) => {
          const ai = CORE_STAT_INDEX.get(String(a.category_name || '').trim()) ?? Number.MAX_SAFE_INTEGER;
          const bi = CORE_STAT_INDEX.get(String(b.category_name || '').trim()) ?? Number.MAX_SAFE_INTEGER;
          return ai - bi;
        }),
    [stats]
  );

  const missingCoreStats = useMemo(() => {
    const existing = new Set(sortedStats.map((s) => String(s.category_name || '').trim()));
    return CORE_STATS.filter((name) => !existing.has(name));
  }, [sortedStats]);

  const mirrorStats = useMemo(
    () =>
      sortedStats.map((s) => ({
        ...s,
        exp_percent: committedExpByStatId[s.id] ?? (Number(s.exp_percent) || 0),
      })),
    [sortedStats, committedExpByStatId]
  );

  const expBonusLevels = useMemo(() => totalExpFloorBonus(sortedStats, pendingExp), [sortedStats, pendingExp]);

  const manualParsed = useMemo(() => {
    const t = manualLevelDraft.trim();
    if (t === '') return null;
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.min(PHYSICAL_AUTONOMY_MAX, n);
  }, [manualLevelDraft]);

  const effectiveBaseLevel = manualParsed ?? memberLevel;
  const simulatedLevel = Math.min(
    PHYSICAL_AUTONOMY_MAX,
    Math.max(1, effectiveBaseLevel + expBonusLevels)
  );

  useEffect(() => {
    if (prevBonusRef.current === null) {
      prevBonusRef.current = expBonusLevels;
      return;
    }
    if (expBonusLevels > prevBonusRef.current) {
      setEpicKey((k) => k + 1);
    }
    prevBonusRef.current = expBonusLevels;
  }, [expBonusLevels]);

  useEffect(() => {
    prevBonusRef.current = null;
  }, [userId]);

  const isStatDirty = useCallback(
    (s) => {
      const p = pendingExp[s.id] ?? (Number(s.exp_percent) || 0);
      const srv = Number(s.exp_percent) || 0;
      const expDirty = Math.abs(p - srv) > 0.04;
      const srvNote = (s.achievement_note ?? '').trim();
      const localNote = (achievementReasonByStatId[s.id] ?? '').trim();
      // 근거 입력은 "다음 저장용 초안": 비운 뒤에는 서버 achievement_note와 달라도 미저장으로 보지 않음.
      const noteDirty = localNote !== '' && localNote !== srvNote;
      return expDirty || noteDirty;
    },
    [pendingExp, achievementReasonByStatId]
  );

  const hasDirtyStats = sortedStats.some(isStatDirty);

  const savePendingToDb = async () => {
    if (!hasDirtyStats) {
      toast('변경된 경험치가 없습니다.', { icon: 'ℹ️' });
      return;
    }
    setSaving(true);
    let anyLevelGain = false;
    const dirtyList = sortedStats.filter((s) => isStatDirty(s));
    try {
      for (const s of dirtyList) {
        const srv = Number(s.exp_percent) || 0;
        const p = Math.min(999999, Math.max(0, pendingExp[s.id] ?? srv));
        const pRounded = Math.round(p);
        const note = (achievementReasonByStatId[s.id] ?? '').trim();

        const { data, error: rpcErr } = await supabase.rpc('admin_apply_member_stat_exp', {
          p_new_exp: pRounded,
          p_reason: note || null,
          p_stat_id: s.id,
          p_target_user: userId,
        });
        if (rpcErr) throw rpcErr;
        if (Number(data?.levels_gained) > 0) anyLevelGain = true;
      }

      /* Keep admin save flow RPC-only: no direct profiles.member_level read. */
      const dbLevel = committedMemberLevel;
      const normalizedLevel = Math.min(
        PHYSICAL_AUTONOMY_MAX,
        Math.max(1, Number.isFinite(dbLevel) ? dbLevel : committedMemberLevel)
      );
      const { data: syncRpc, error: syncErr } = await supabase.rpc('admin_force_sync_level', {
        p_target_user: userId,
        p_new_level: normalizedLevel,
      });
      if (syncErr) throw syncErr;
      const syncedLevel =
        syncRpc?.member_level != null ? Number(syncRpc.member_level) : normalizedLevel;

      // Right simulator updates only after DB save success (pessimistic UI).
      setCommittedExpByStatId((prev) => {
        const next = { ...prev };
        for (const s of dirtyList) {
          const srv = Number(s.exp_percent) || 0;
          const p = Math.min(999999, Math.max(0, pendingExp[s.id] ?? srv));
          next[s.id] = Math.round(p);
        }
        return next;
      });
      if (Number.isFinite(syncedLevel)) {
        setCommittedMemberLevel(Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, syncedLevel)));
      }

      setLedgerRefreshKey((k) => k + 1);

      setAchievementReasonByStatId((prev) => {
        const next = { ...prev };
        for (const s of dirtyList) {
          next[s.id] = '';
        }
        return next;
      });

      await onRefresh?.();
      if (Number.isFinite(syncedLevel)) {
        onMemberLevelSynced?.(syncedLevel);
      }
      const finalLevel = Number.isFinite(syncedLevel) ? syncedLevel : null;
      if (anyLevelGain && finalLevel != null && Number.isFinite(finalLevel)) {
        try {
          await invokeNotifyMemberEvents(
            userId,
            '레벨 업',
            `축하합니다! 레벨이 ${finalLevel}으로 상승했습니다. 당신의 성장이 기록되었습니다.`,
            'level_up'
          );
        } catch (e) {
          console.warn('[MemberStatusTab] level push', e);
        }
        toast.success(`레벨 ${finalLevel} 업 알림이 발송되었습니다.`);
      }
      toast.success('데이터 동기화 완료: 아틀리트 상태가 갱신되었습니다.');
    } catch (e) {
      console.error('[MemberStatusTab] save', e);
      toast.error(`저장 실패: ${supabaseErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const persistProfileLevel = async () => {
    if (manualParsed == null) {
      toast.error('1 이상의 정수 레벨을 입력하세요.');
      return;
    }
    if (!userId) {
      toast.error('회원 정보가 없습니다.');
      return;
    }

    const prevLevel = Number(memberLevel) || 1;
    const targetLevel = Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, manualParsed));
    setSaving(true);
    try {
      const { data: rpcData, error } = await supabase.rpc('admin_force_sync_level', {
        p_target_user: userId,
        p_new_level: targetLevel,
      });

      if (error) throw error;

      const appliedLevel =
        rpcData?.member_level != null ? Number(rpcData.member_level) : targetLevel;

      setCommittedMemberLevel(Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, appliedLevel)));
      onMemberLevelSynced?.(appliedLevel);
      setManualLevelDraft('');

      if (appliedLevel > prevLevel) {
        setEpicKey((k) => k + 1);
      }

      toast.success('프로필 레벨이 반영되었습니다.');
      await onRefresh?.();
    } catch (e) {
      console.error('[MemberStatusTab] admin_force_sync_level', e);
      toast.error('레벨 동기화 실패: 시스템 관리자에게 문의하십시오.');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async (name) => {
    const trimmed = String(name || '').trim();
    if (!CORE_STAT_SET.has(trimmed)) {
      toast.error('코어 스탯 5종만 추가할 수 있습니다.');
      return;
    }
    if (!userId) {
      toast.error('회원 정보가 없습니다. 페이지를 새로고침 해 보세요.');
      return;
    }
    setAdding(true);
    const row = {
      user_id: userId,
      category_name: trimmed,
      exp_percent: 0,
      level: 1,
    };
    const { data: inserted, error } = await supabase.from('member_stats').insert(row).select('id').maybeSingle();
    setAdding(false);
    if (error) {
      if (error.code === '23505') {
        toast.error('이미 같은 이름의 항목이 있습니다.');
      } else if (error.code === 'PGRST204' || /column/i.test(error.message || '')) {
        console.error('[MemberStatusTab] insert member_stats (schema?)', error);
        toast.error(`항목 추가 실패: 컬럼 불일치 — ${supabaseErrorMessage(error)}`);
      } else {
        console.error('[MemberStatusTab] insert member_stats', error);
        toast.error(`항목 추가 실패: ${supabaseErrorMessage(error)}`);
      }
      return;
    }
    if (!inserted?.id) {
      console.warn('[MemberStatusTab] insert returned no row (RLS SELECT on insert?)', { row });
      toast.error('항목은 생성됐을 수 있으나 응답이 막혔습니다. 목록을 새로고침 해 보세요.');
      await onRefresh?.();
      return;
    }
    toast.success(`${trimmed} 항목이 추가되었습니다.`);
    await onRefresh?.();
  };

  return (
    <div className="flex flex-col gap-10 xl:flex-row xl:items-start xl:gap-10">
      {/* Left: gamified glass control deck */}
      <div className="min-w-0 flex-1 rounded-3xl bg-[#030303] p-4 ring-1 ring-emerald-500/15">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <div className="border-b border-white/10 pb-5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-400/80">Control Deck</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              슬라이더 변경은 좌측 초안에만 반영됩니다. 확정은 하단 <span className="text-emerald-300/90">APPLY</span>로만
              서버에 기록됩니다.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">Baseline Level</h3>
              <p className="mt-1 text-[11px] text-white/40">
                Physical Autonomy 1–{PHYSICAL_AUTONOMY_MAX}. 비우면 프로필 LV.{Math.min(PHYSICAL_AUTONOMY_MAX, memberLevel)}{' '}
                사용. 「SYNC PROFILE」으로 RPC 반영.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[120px] flex-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-white/35">Preview LV</label>
                  <input
                    type="number"
                    min={1}
                    max={PHYSICAL_AUTONOMY_MAX}
                    value={manualLevelDraft}
                    onChange={(e) => setManualLevelDraft(e.target.value)}
                    placeholder={`${Math.min(PHYSICAL_AUTONOMY_MAX, memberLevel)}`}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm tabular-nums text-white outline-none ring-emerald-500/30 placeholder:text-white/25 focus:ring-2"
                  />
                </div>
                <button
                  type="button"
                  disabled={saving || manualParsed == null}
                  onClick={persistProfileLevel}
                  className="rounded-xl border border-emerald-500/35 bg-emerald-950/50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-emerald-100/90 transition hover:border-emerald-400/50 hover:bg-emerald-900/40 disabled:opacity-40"
                >
                  Sync Profile
                </button>
              </div>
              <p className="mt-3 text-xs text-emerald-400/80">
                Sim LV{' '}
                <span className="font-mono font-bold tabular-nums text-emerald-200">{simulatedLevel}</span>
                {expBonusLevels > 0 ? (
                  <span className="text-white/35"> · +{expBonusLevels} from 100% segments</span>
                ) : null}
              </p>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">Core Stats</h3>
              <p className="mt-1 text-[11px] text-white/40">
                Athlete Status는 5개 코어 바이오메트릭만 사용합니다. 빠른 추가로 오타를 방지하세요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CORE_STATS.map((name) => {
                  const exists = !missingCoreStats.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={adding || exists}
                      onClick={() => addCategory(name)}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-semibold tracking-wide transition ${
                        exists
                          ? 'border-white/10 bg-white/5 text-white/30'
                          : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100/90 hover:border-emerald-400/60 hover:bg-emerald-900/45'
                      } disabled:cursor-not-allowed`}
                    >
                      {exists ? `${name} · Added` : name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">EXP Faders</h3>
              <p className="mt-1 text-[11px] text-white/40">
                100% 구간을 넘기면 시뮬레이션 레벨이 즉시 상승합니다. 확정 저장은 APPLY 버튼.
              </p>

              {sortedStats.length === 0 ? (
                <p className="mt-6 text-sm text-white/30">코어 스탯을 추가하면 페이더가 나타납니다.</p>
              ) : (
                <ul className="mt-6 space-y-7">
                  {sortedStats.map((s) => {
                    const local = pendingExp[s.id] ?? 0;
                    const dirty = isStatDirty(s);
                    const pct = Math.min(100, Math.max(0, local));
                    return (
                      <li key={s.id} className="rounded-xl border border-white/5 bg-black/25 px-4 py-4">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold tracking-tight text-white/90">{s.category_name}</p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/35">
                              Cat Lv.{s.level} · Server {Math.round(Number(s.exp_percent) * 10) / 10}%
                              {dirty ? <span className="ml-2 text-amber-400/90">· UNSAVED</span> : null}
                            </p>
                          </div>
                          <span className="font-mono text-lg font-bold tabular-nums text-emerald-400">
                            {Math.round(local * 10) / 10}
                            <span className="text-xs text-emerald-500/60">%</span>
                          </span>
                        </div>
                        <div className="mt-4">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={pct}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setPendingExp((prev) => ({ ...prev, [s.id]: n }));
                            }}
                            className="premium-exp-slider accent-emerald-500"
                            style={{
                              background: `linear-gradient(to right, rgba(16,185,129,0.55) 0%, rgba(5,150,105,0.85) ${pct}%, rgba(255,255,255,0.07) ${pct}%, rgba(255,255,255,0.07) 100%)`,
                            }}
                          />
                        </div>
                        <div className="mt-3">
                          <label className="text-[10px] font-medium uppercase tracking-wider text-emerald-500/50">
                            성취 근거 (Reason for Achievement)
                          </label>
                          <textarea
                            value={achievementReasonByStatId[s.id] ?? ''}
                            onChange={(e) =>
                              setAchievementReasonByStatId((prev) => ({
                                ...prev,
                                [s.id]: e.target.value,
                              }))
                            }
                            rows={2}
                            placeholder="예: 스쿼트 1RM 목표 달성, 주 3회 루틴 준수 등"
                            className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/90 outline-none ring-emerald-500/25 placeholder:text-white/25 focus:ring-2"
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-white/10 pt-6">
              <Motion.button
                type="button"
                disabled={saving || !hasDirtyStats}
                onClick={savePendingToDb}
                whileHover={hasDirtyStats && !saving ? { scale: 1.02 } : {}}
                whileTap={hasDirtyStats && !saving ? { scale: 0.98 } : {}}
                className="apply-exp-cta relative w-full overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-white shadow-[0_0_32px_rgba(16,185,129,0.25)] transition disabled:cursor-not-allowed disabled:opacity-35"
              >
                <span className="relative z-10">Apply Exp // Level Up</span>
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.12)_45%,transparent_90%)] opacity-60" />
              </Motion.button>
              <p className="mt-3 text-center text-[10px] text-white/30">
                {hasDirtyStats ? 'Pending matrix changes — commit to database.' : 'No pending EXP deltas.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right: member mirror — chart-first, no gray list */}
      <div className="shrink-0 xl:sticky xl:top-6 xl:self-start">
        <MemberPhoneMirror label="Live Matrix">
          <div className="space-y-6 px-1">
            <AthleteStatus
              memberName={displayName}
              memberLevel={committedMemberLevel}
              stats={mirrorStats}
              subtitle="Physical Autonomy"
              compact
              epicLevelUpKey={epicKey}
            />
            <div>
              <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-[0.35em] text-white/30">
                Growth Ledger
              </p>
              <MemberSimulatorLedger memberId={userId} refreshKey={ledgerRefreshKey} />
            </div>
          </div>
        </MemberPhoneMirror>
      </div>
    </div>
  );
}
