import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { invokeNotifyMemberEvents } from '../../utils/notifications';
import AthleteStatCard from './AthleteStatCard';

export default function MemberStatusTab({ userId, profile, stats, memberLevel, onRefresh }) {
  const [categoryInput, setCategoryInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [pendingExp, setPendingExp] = useState(() =>
    Object.fromEntries((stats || []).map((s) => [s.id, Math.round(Number(s.exp_percent) * 10) / 10]))
  );

  React.useEffect(() => {
    setPendingExp(Object.fromEntries((stats || []).map((s) => [s.id, Math.round(Number(s.exp_percent) * 10) / 10])));
  }, [stats]);

  const displayName = profile?.name || '회원';

  const sortedStats = useMemo(
    () => [...(stats || [])].sort((a, b) => (a.category_name || '').localeCompare(b.category_name || '', 'ko')),
    [stats]
  );

  const applyExp = useCallback(
    async (statId, rawValue, prevServerExp) => {
      const v = Math.min(999999, Math.max(0, Number(rawValue)));
      const prev = Number(prevServerExp) || 0;
      if (Math.abs(v - prev) < 0.05 && v < 100) {
        return;
      }
      const { data, error } = await supabase.rpc('admin_apply_member_stat_exp', {
        p_target_user: userId,
        p_stat_id: statId,
        p_new_exp: v,
      });
      if (error) {
        console.error('[MemberStatusTab] admin_apply_member_stat_exp', error);
        toast.error('경험치 저장에 실패했습니다.');
        return;
      }
      const levelsGained = Number(data?.levels_gained) || 0;
      const newLevel = Number(data?.member_level);
      if (levelsGained > 0 && Number.isFinite(newLevel)) {
        try {
          await invokeNotifyMemberEvents(
            userId,
            '레벨 업',
            `축하합니다! 레벨이 ${newLevel}으로 상승했습니다. 당신의 성장이 기록되었습니다.`,
            'level_up'
          );
        } catch (e) {
          console.warn('[MemberStatusTab] level push', e);
        }
        toast.success(`레벨 ${newLevel} 달성 — 알림을 보냈습니다.`);
      } else {
        toast.success('저장되었습니다.');
      }
      await onRefresh?.();
    },
    [userId, onRefresh]
  );

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
    <div className="space-y-10">
      <AthleteStatCard memberName={displayName} memberLevel={memberLevel} stats={stats} />

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
          슬라이더를 놓으면 저장됩니다. 100%에 도달하면 회원 전체 레벨이 오르고, 남은 경험치는 이월됩니다.
        </p>

        {sortedStats.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">먼저 항목을 추가하세요.</p>
        ) : (
          <ul className="mt-5 space-y-8">
            {sortedStats.map((s) => {
              const local = pendingExp[s.id] ?? 0;
              return (
                <li key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{s.category_name}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-400">
                        카테고리 Lv.{s.level} · 서버 EXP {Math.round(Number(s.exp_percent) * 10) / 10}%
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
                      onPointerUp={(e) => {
                        if (e.button === 2) return;
                        applyExp(s.id, Number(e.currentTarget.value), s.exp_percent);
                      }}
                      onKeyUp={(e) => {
                        if (e.key === 'Enter') applyExp(s.id, Number(e.currentTarget.value));
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
    </div>
  );
}
