import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { motion as Motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';
import MemberGrowthLedger from './MemberGrowthLedger';
import MemberPhoneMirror from './MemberPhoneMirror';

const PHYSICAL_AUTONOMY_MAX = 10;

function supabaseErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'object' && error !== null) {
    const bits = [error.message, error.details, error.hint].filter(Boolean);
    if (bits.length) return bits.join(' — ');
  }
  return String(error);
}

export default function MemberStatusTab({ userId, profile, stats, memberLevel, onRefresh, onMemberLevelSynced }) {
  const [saving, setSaving] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [customComment, setCustomComment] = useState('');
  const [roadmapGuides, setRoadmapGuides] = useState([]);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [committedMemberLevel, setCommittedMemberLevel] = useState(() => {
    const n = Number(memberLevel);
    return Number.isFinite(n) ? Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n)) : 1;
  });
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);

  useEffect(() => {
    const n = Number(memberLevel);
    setCommittedMemberLevel(Number.isFinite(n) ? Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n)) : 1);
  }, [memberLevel, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingGuides(true);
      const { data, error } = await supabase
        .from('roadmap_guides')
        .select('*')
        .order('phase_order', { ascending: true });
      if (cancelled) return;
      setLoadingGuides(false);
      if (error) {
        console.error('[MemberStatusTab] roadmap_guides', error);
        setRoadmapGuides([]);
        return;
      }
      setRoadmapGuides(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = profile?.name || '회원';

  const selectedLevelNumber = useMemo(() => {
    const n = Number.parseInt(selectedLevel, 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n));
  }, [selectedLevel]);

  const selectedGuide = useMemo(() => {
    if (selectedLevelNumber == null) return null;
    return (
      roadmapGuides.find((row) => {
        const nums = String(row.level_range || '')
          .match(/\d+/g)
          ?.map((v) => Number.parseInt(v, 10))
          .filter((v) => Number.isFinite(v));
        if (!nums || nums.length === 0) return false;
        const min = nums.length === 1 ? nums[0] : Math.min(nums[0], nums[1]);
        const max = nums.length === 1 ? nums[0] : Math.max(nums[0], nums[1]);
        return selectedLevelNumber >= min && selectedLevelNumber <= max;
      }) || null
    );
  }, [roadmapGuides, selectedLevelNumber]);

  const standardComment = selectedGuide?.description ? String(selectedGuide.description) : '';

  const saveGrowthRecord = async () => {
    if (!userId) {
      toast.error('회원 정보가 없습니다.');
      return;
    }
    if (selectedLevelNumber == null) {
      toast.error('레벨을 선택하세요.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_save_growth_record', {
        p_target_user: userId,
        p_new_level: selectedLevelNumber,
        p_standard_comment: standardComment || null,
        p_custom_comment: customComment.trim() || null,
      });
      if (error) throw error;

      setCommittedMemberLevel(selectedLevelNumber);
      setLedgerRefreshKey((k) => k + 1);
      setCustomComment('');
      await onRefresh?.();
      onMemberLevelSynced?.(selectedLevelNumber);
      toast.success('성장 기록이 저장되었습니다.');
    } catch (e) {
      console.error('[MemberStatusTab] admin_save_growth_record', e);
      toast.error(`저장 실패: ${supabaseErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-10 xl:flex-row xl:items-start xl:gap-10">
      <div className="min-w-0 flex-1 rounded-3xl bg-[#030303] p-4 ring-1 ring-emerald-500/15">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <div className="border-b border-white/10 pb-5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-400/80">Control Deck</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              이제 스탯 퍼센트는 사용하지 않습니다. 레벨과 코멘트만 저장합니다.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">레벨 부여</h3>
              <p className="mt-1 text-[11px] text-white/40">회원의 목표 레벨(1~10)을 선택하세요.</p>
              <div className="mt-3">
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/30 focus:ring-2"
                >
                  <option value="">레벨 선택</option>
                  {Array.from({ length: PHYSICAL_AUTONOMY_MAX }, (_, i) => i + 1).map((lv) => (
                    <option key={lv} value={String(lv)}>
                      LV. {lv}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">해당 레벨 표준 기준</h3>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm leading-relaxed text-white/75">
                {loadingGuides
                  ? '기준 불러오는 중...'
                  : standardComment || '선택한 레벨의 기준이 없습니다. roadmap_guides를 확인하세요.'}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">
                개별 코멘트 (선택 사항)
              </label>
              <textarea
                value={customComment}
                onChange={(e) => setCustomComment(e.target.value)}
                rows={4}
                placeholder="예: 지난 4주간 루틴 준수율이 높고 폼 안정성이 크게 향상되었습니다."
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/90 outline-none ring-emerald-500/25 placeholder:text-white/25 focus:ring-2"
              />
            </div>

            <div className="border-t border-white/10 pt-6">
              <Motion.button
                type="button"
                disabled={saving || selectedLevelNumber == null}
                onClick={saveGrowthRecord}
                whileHover={!saving && selectedLevelNumber != null ? { scale: 1.02 } : {}}
                whileTap={!saving && selectedLevelNumber != null ? { scale: 0.98 } : {}}
                className="apply-exp-cta relative w-full overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-white shadow-[0_0_32px_rgba(16,185,129,0.25)] transition disabled:cursor-not-allowed disabled:opacity-35"
              >
                <span className="relative z-10">저장</span>
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.12)_45%,transparent_90%)] opacity-60" />
              </Motion.button>
              <p className="mt-3 text-center text-[10px] text-white/30">
                {selectedLevelNumber == null ? '레벨을 먼저 선택하세요.' : '선택 레벨과 코멘트를 성장 기록에 저장합니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 xl:sticky xl:top-6 xl:self-start">
        <MemberPhoneMirror label="아틀리트 상태">
          <div className="space-y-6 px-1">
            <AthleteStatus
              memberName={displayName}
              memberLevel={committedMemberLevel}
              subtitle="아틀리트 상태"
              epicLevelUpKey={0}
            />
            <div>
              <p className="mb-3 text-center text-[11px] font-medium tracking-[0.2em] text-white/40">
                성장 기록
              </p>
              <MemberGrowthLedger targetUserId={userId} refreshKey={ledgerRefreshKey} />
            </div>
          </div>
        </MemberPhoneMirror>
      </div>
    </div>
  );
}
