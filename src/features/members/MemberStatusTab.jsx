import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Save } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { invokeNotifyMemberEvents } from '../../utils/notifications';
import VaultArchivePreview from '../../components/vault/VaultArchivePreview';
import AthleteStatus from './AthleteStatus';
import LevelUpEpicFX from './LevelUpEpicFX';
import MemberPhoneMirror from './MemberPhoneMirror';

function totalExpFloorBonus(stats, pendingExp) {
  return stats.reduce((acc, s) => {
    const v = pendingExp[s.id] ?? (Number(s.exp_percent) || 0);
    return acc + Math.floor(v / 100);
  }, 0);
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
        const p = Math.min(999999, Math.max(0, pendingExp[s.id] ?? (Number(s.exp_percent) || 0)));
        const { data, error } = await supabase.rpc('admin_apply_member_stat_exp', {
          p_target_user: userId,
          p_stat_id: s.id,
          p_new_exp: p,
        });
        if (error) throw error;
        if (Number(data?.levels_gained) > 0) anyLevelGain = true;
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
      toast.error('저장에 실패했습니다.');
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
    const name = categoryInput.trim();
    if (!name) {
      toast.error('항목 이름을 입력하세요.');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('member_stats').insert({
      user_id: userId,
      category_name: name,
      exp_percent: 0,
      level: 1,
    });
    setAdding(false);
    if (error) {
      if (error.code === '23505') {
        toast.error('이미 같은 이름의 항목이 있습니다.');
      } else {
        console.error('[MemberStatusTab] insert member_stats', error);
        toast.error('항목 추가에 실패했습니다.');
      }
      return;
    }
    setCategoryInput('');
    toast.success('항목이 추가되었습니다.');
    await onRefresh?.();
  };

  return (
    <div className="flex flex-col gap-10 xl:flex-row xl:items-start xl:gap-10">
      {/* Left: control panel */}
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Control Panel</h2>
          <p className="mt-1 text-sm text-neutral-600">슬라이더는 즉시 미러에 반영됩니다. DB 저장은 하단 버튼을 누르세요.</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
          <h3 className="text-sm font-semibold text-neutral-900">레벨 (미리보기 / 수동)</h3>
          <p className="mt-1 text-xs text-neutral-500">
            빈 칸이면 프로필 레벨(LV.{memberLevel}) 기준. 숫자를 넣으면 미리보기만 바뀝니다. 「프로필에 저장」으로 DB 반영.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[120px] flex-1">
              <label className="text-[10px] font-medium text-neutral-400">미리보기 기준 LV</label>
              <input
                type="number"
                min={1}
                value={manualLevelDraft}
                onChange={(e) => setManualLevelDraft(e.target.value)}
                placeholder={`기본: ${memberLevel}`}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm tabular-nums outline-none ring-emerald-600/20 focus:ring-2"
              />
            </div>
            <button
              type="button"
              disabled={saving || manualParsed == null}
              onClick={persistProfileLevel}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              프로필에 저장
            </button>
          </div>
          <p className="mt-2 text-xs text-emerald-800/90">
            시뮬레이션 LV: <span className="font-bold tabular-nums">{simulatedLevel}</span>
            {expBonusLevels > 0 ? (
              <span className="text-neutral-500"> (슬라이더 100% 구간 +{expBonusLevels})</span>
            ) : null}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
          <h3 className="text-sm font-semibold text-neutral-900">항목 추가</h3>
          <p className="mt-1 text-xs text-neutral-500">예: Strength, 유산소, 코어 등 원하는 이름을 입력하세요.</p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              placeholder="카테고리 이름"
              className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-600/20 focus:ring-2"
            />
            <button
              type="button"
              disabled={adding}
              onClick={addCategory}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#064e3b] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#053d2f] disabled:opacity-50"
            >
              <Plus size={14} />
              추가
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-neutral-900">경험치 제어</h3>
          <p className="mt-1 text-xs text-neutral-500">
            드래그 중 미러·레이더·레벨(100% 누적)이 실시간 갱신됩니다. 저장 시에만 서버·푸시가 반영됩니다.
          </p>

          {sortedStats.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">먼저 항목을 추가하세요.</p>
          ) : (
            <ul className="mt-5 space-y-8">
              {sortedStats.map((s) => {
                const local = pendingExp[s.id] ?? 0;
                const dirty = isStatDirty(s);
                return (
                  <li key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{s.category_name}</p>
                        <p className="mt-0.5 text-[11px] text-neutral-400">
                          카테고리 Lv.{s.level} · DB EXP {Math.round(Number(s.exp_percent) * 10) / 10}%
                          {dirty ? <span className="ml-2 text-amber-600">· 미저장</span> : null}
                        </p>
                      </div>
                      <span className="tabular-nums text-lg font-bold text-emerald-700">{Math.round(local * 10) / 10}%</span>
                    </div>
                    <div className="mt-4">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.5}
                        value={Math.min(100, Math.max(0, local))}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setPendingExp((prev) => ({ ...prev, [s.id]: n }));
                        }}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-emerald-600"
                        style={{
                          background: `linear-gradient(to right, rgb(5 150 105) 0%, rgb(5 150 105) ${local}%, rgb(229 231 235) ${local}%, rgb(229 231 235) 100%)`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-900/15 bg-emerald-950/[0.03] p-4">
          <button
            type="button"
            disabled={saving || !hasDirtyStats}
            onClick={savePendingToDb}
            className="inline-flex items-center gap-2 rounded-xl bg-[#064e3b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#053d2f] disabled:opacity-50"
          >
            <Save size={18} />
            변경사항 DB 저장
          </button>
          {!hasDirtyStats ? (
            <span className="text-xs text-neutral-500">저장할 경험치 변경이 없습니다.</span>
          ) : (
            <span className="text-xs text-amber-700">미저장 변경이 있습니다.</span>
          )}
        </div>
      </div>

      {/* Right: member mirror */}
      <div className="shrink-0 xl:sticky xl:top-6 xl:self-start">
        <MemberPhoneMirror label="Live Member Mirror">
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-3xl">
              <LevelUpEpicFX triggerKey={epicKey} />
              <AthleteStatus
                memberName={displayName}
                memberLevel={simulatedLevel}
                stats={mirrorStats}
                subtitle="내 스테이터스"
                compact
                epicLevelUpKey={epicKey}
              />
            </div>
            <div>
              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">볼트</p>
              <VaultArchivePreview embedded className="shadow-lg" />
            </div>
          </div>
        </MemberPhoneMirror>
      </div>
    </div>
  );
}
