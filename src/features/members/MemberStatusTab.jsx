import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { motion as Motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { invokeNotifyMemberEvents } from '../../utils/notifications';
import VaultArchivePreview from '../../components/vault/VaultArchivePreview';
import AthleteStatus from './AthleteStatus';
import MemberPhoneMirror from './MemberPhoneMirror';

function totalExpFloorBonus(stats, pendingExp) {
  return stats.reduce((acc, s) => {
    const v = pendingExp[s.id] ?? (Number(s.exp_percent) || 0);
    return acc + Math.floor(v / 100);
  }, 0);
}

/** Align with DB numeric(6,2) and CHECK (exp_percent < 100). */
function clampStoredExpPercent(p) {
  const floor100 = Math.floor(p / 100) * 100;
  const r = p - floor100;
  return Math.round(Math.min(99.99, Math.max(0, r)) * 100) / 100;
}

function supabaseErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'object' && error !== null) {
    const bits = [error.message, error.details, error.hint].filter(Boolean);
    if (bits.length) return bits.join(' — ');
  }
  return String(error);
}

export default function MemberStatusTab({ userId, profile, stats, memberLevel, onRefresh }) {
  const [categoryInput, setCategoryInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualLevelDraft, setManualLevelDraft] = useState('');
  const [pendingExp, setPendingExp] = useState(() =>
    Object.fromEntries((stats || []).map((s) => [s.id, Math.round(Number(s.exp_percent) * 10) / 10]))
  );
  const [epicKey, setEpicKey] = useState(0);

  const prevBonusRef = useRef(null);

  useEffect(() => {
    setPendingExp(Object.fromEntries((stats || []).map((s) => [s.id, Math.round(Number(s.exp_percent) * 10) / 10])));
  }, [stats]);

  const displayName = profile?.name || '회원';

  const sortedStats = useMemo(
    () => [...(stats || [])].sort((a, b) => (a.category_name || '').localeCompare(b.category_name || '', 'ko')),
    [stats]
  );

  const mirrorStats = useMemo(
    () =>
      sortedStats.map((s) => ({
        ...s,
        exp_percent: pendingExp[s.id] ?? (Number(s.exp_percent) || 0),
      })),
    [sortedStats, pendingExp]
  );

  const expBonusLevels = useMemo(() => totalExpFloorBonus(sortedStats, pendingExp), [sortedStats, pendingExp]);

  const manualParsed = useMemo(() => {
    const t = manualLevelDraft.trim();
    if (t === '') return null;
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  }, [manualLevelDraft]);

  const effectiveBaseLevel = manualParsed ?? memberLevel;
  const simulatedLevel = Math.max(1, effectiveBaseLevel + expBonusLevels);

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
      return Math.abs(p - srv) > 0.04;
    },
    [pendingExp]
  );

  const hasDirtyStats = sortedStats.some(isStatDirty);

  const savePendingToDb = async () => {
    if (!hasDirtyStats) {
      toast('변경된 경험치가 없습니다.', { icon: 'ℹ️' });
      return;
    }
    setSaving(true);
    let anyLevelGain = false;
    try {
      for (const s of sortedStats) {
        if (!isStatDirty(s)) continue;
        const srv = Number(s.exp_percent) || 0;
        const p = Math.min(999999, Math.max(0, pendingExp[s.id] ?? srv));
        const levelsDelta = Math.floor(p / 100) - Math.floor(srv / 100);

        if (levelsDelta === 0) {
          const nextExp = clampStoredExpPercent(p);
          const { error: upErr } = await supabase
            .from('member_stats')
            .update({
              exp_percent: nextExp,
              updated_at: new Date().toISOString(),
            })
            .eq('id', s.id)
            .eq('user_id', userId);
          if (upErr) throw upErr;
        } else {
          const { data, error: rpcErr } = await supabase.rpc('admin_apply_member_stat_exp', {
            p_new_exp: p,
            p_stat_id: s.id,
            p_target_user: userId,
          });
          if (rpcErr) throw rpcErr;
          if (Number(data?.levels_gained) > 0) anyLevelGain = true;
        }
      }
      await onRefresh?.();
      let finalLevel = null;
      if (anyLevelGain) {
        const { data: prof } = await supabase.from('profiles').select('member_level').eq('id', userId).maybeSingle();
        finalLevel = prof?.member_level != null ? Number(prof.member_level) : null;
      }
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
        toast.success(`저장 완료 · 레벨 ${finalLevel} (알림 발송)`);
      } else {
        toast.success('저장되었습니다.');
      }
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
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ member_level: manualParsed }).eq('id', userId);
    setSaving(false);
    if (error) {
      console.error('[MemberStatusTab] profile level', error);
      toast.error('프로필 레벨 저장 실패');
      return;
    }
    toast.success('프로필 레벨이 반영되었습니다.');
    await onRefresh?.();
  };

  const addCategory = async () => {
    const raw = categoryInput.trim().replace(/\s+/g, ' ');
    const name = raw.slice(0, 200);
    if (!name) {
      toast.error('항목 이름을 입력하세요.');
      return;
    }
    if (!userId) {
      toast.error('회원 정보가 없습니다. 페이지를 새로고침 해 보세요.');
      return;
    }
    setAdding(true);
    const row = {
      user_id: userId,
      category_name: name,
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
      setCategoryInput('');
      return;
    }
    setCategoryInput('');
    toast.success('항목이 추가되었습니다.');
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
              슬라이더는 즉시 오른쪽 매트릭스에 반영됩니다. 확정은 하단 <span className="text-emerald-300/90">APPLY</span>로만
              서버에 기록됩니다.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">Baseline Level</h3>
              <p className="mt-1 text-[11px] text-white/40">
                비우면 프로필 LV.{memberLevel} 사용. 입력 시 미리보기만 변경 — 「SYNC PROFILE」으로 DB 반영.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[120px] flex-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-white/35">Preview LV</label>
                  <input
                    type="number"
                    min={1}
                    value={manualLevelDraft}
                    onChange={(e) => setManualLevelDraft(e.target.value)}
                    placeholder={`${memberLevel}`}
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
                Sim LV <span className="font-mono font-bold tabular-nums text-emerald-200">{simulatedLevel}</span>
                {expBonusLevels > 0 ? (
                  <span className="text-white/35"> · +{expBonusLevels} from 100% segments</span>
                ) : null}
              </p>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">New Axis</h3>
              <p className="mt-1 text-[11px] text-white/40">Strength, Endurance, 유산소 등 — 레이더 꼭짓점이 됩니다.</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  placeholder="Category name"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/30 placeholder:text-white/25 focus:ring-2"
                />
                <button
                  type="button"
                  disabled={adding}
                  onClick={addCategory}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-gradient-to-b from-emerald-600 to-emerald-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-50"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Add
                </button>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">EXP Faders</h3>
              <p className="mt-1 text-[11px] text-white/40">
                100% 구간을 넘기면 시뮬레이션 레벨이 즉시 상승합니다. 확정 저장은 APPLY 버튼.
              </p>

              {sortedStats.length === 0 ? (
                <p className="mt-6 text-sm text-white/30">카테고리를 추가하면 페이더가 나타납니다.</p>
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
                            step={0.5}
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
              memberLevel={simulatedLevel}
              stats={mirrorStats}
              subtitle="Athlete Matrix"
              compact
              epicLevelUpKey={epicKey}
            />
            <div>
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-500/45">
                Vault Archive
              </p>
              <VaultArchivePreview embedded className="shadow-[0_0_40px_rgba(0,0,0,0.6)]" />
            </div>
          </div>
        </MemberPhoneMirror>
      </div>
    </div>
  );
}
